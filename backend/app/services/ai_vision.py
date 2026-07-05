"""AI Vision APIを用いた種苗パッケージ画像解析(Phase 6 + ローカルLLM拡張)。

spec.md 4.3「種苗会社画像のAI解析」に対応する。以下の2プロバイダーに
対応し、環境変数で自動選択する:

- Anthropic Claude Vision API(`ANTHROPIC_API_KEY` 設定時。既存の挙動)
- OpenAI互換のローカル/リモートサーバー(`AI_VISION_BASE_URL` 設定時。
  llama.cpp server等、マルチモーダル対応モデルを想定)

優先順位は `ANTHROPIC_API_KEY` > `AI_VISION_BASE_URL` で、どちらも
未設定の場合は `is_ai_configured()` が `False` を返し、
APIルーター側で503フォールバックする(既存の挙動を変更しない)。

実際の通信部分をここに分離することで、
- APIルーター(`app/api/ai_analysis.py`)からは `analyze_variety_image` を
  呼ぶだけにする
- ユニットテストからは `analyze_variety_image` をモックし、実際にAPIキーや
  ネットワークが無い環境でもルーターのロジック(保存/レスポンス組み立て/
  エラーハンドリング)を検証できるようにする

という2点を満たす。
"""

from __future__ import annotations

import base64
import io
import json
import os
import re

from app.services.extraction_normalize import normalize_numeric_fields

# spec.md 7章「推奨技術構成」に記載のモデルID(Anthropic使用時)。
ANALYSIS_MODEL = "claude-sonnet-5"

# AI呼び出し前の画像リサイズ設定(速度・トークン節約のため)。
# 実際のユーザーは3000x4000px程度のスマホ写真をアップロードすることを
# 想定しているため、長辺をこのサイズまで縮小してからBase64エンコードする。
MAX_IMAGE_DIMENSION = 1600
RESIZED_JPEG_QUALITY = 85

# 種苗パッケージ画像から栽培暦等を抽出させるためのプロンプト。
# - JSON以外のテキストを含めないよう強く指示する（パース処理を単純化するため）。
# - 地域帯(寒地/温暖地/暖地)が画像に無い場合はtemperateのみ埋める等、
#   柔軟に対応するよう指示する（spec.md 4.3, docs/implementation-plan.md Phase6）。
PROMPT = """\
あなたは日本の農業・園芸の専門家です。添付された画像は、種苗会社が配布する
種袋の裏面や作付け説明資料（栽培歴表・イラスト）です。この画像から栽培情報を
読み取り、必ず次のJSON形式のみで出力してください。前置き・説明文・
コードフェンス以外のテキストは一切含めないでください。

{
  "cultivation_calendar": {
    "cold": {"sowing": "...", "transplanting": "...", "harvest": "..."},
    "temperate": {"sowing": "...", "transplanting": "...", "harvest": "..."},
    "warm": {"sowing": "...", "transplanting": "...", "harvest": "..."}
  },
  "seedling_days": 60,
  "days_to_harvest": 90,
  "plant_spacing_cm": 45,
  "row_spacing_cm": 60,
  "mulch_type": "黒マルチ",
  "protection_notes": "..."
}

注意事項:
- 画像に地域帯(寒地/温暖地/暖地)の区別がなく、時期が1種類しか記載されて
  いない場合は、cultivation_calendar.temperate（温暖地）のみを埋め、
  cold/warm のキーは省略してください。
- 一部の地域帯のみ記載がある場合は、記載がある地域帯のキーのみ出力して
  ください。
- sowing(種蒔き時期)・transplanting(植え付け時期)・harvest(収穫時期)の
  いずれかが読み取れない場合は、そのキーを省略するかnullにしてください。
- seedling_days(育苗日数)・days_to_harvest(種蒔きまたは植え付けから収穫
  までの日数目安)・plant_spacing_cm(株間)・row_spacing_cm(条間)は数値の
  みで出力し、読み取れない場合はnullにしてください。
- mulch_type(マルチング種別)・protection_notes(保温・保湿対策や日照条件、
  その他の栽培上の注意点)は文字列で出力し、読み取れない場合はnullに
  してください。
- 上記のキー以外は出力しないでください。
"""

# Anthropic Vision APIが受け付けるmedia_type。他の値の場合は呼び出し側で
# image/jpeg にフォールバックする。
SUPPORTED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def is_ai_configured() -> bool:
    """AI画像解析が利用可能な設定になっているかどうかを返す。

    `ANTHROPIC_API_KEY` または `AI_VISION_BASE_URL`(ローカル/リモートの
    OpenAI互換サーバー)のいずれかが設定されていれば `True`。
    """

    return bool(os.getenv("ANTHROPIC_API_KEY")) or bool(os.getenv("AI_VISION_BASE_URL"))


def _resize_image_for_ai(image_bytes: bytes, media_type: str) -> tuple[bytes, str]:
    """AI呼び出し用に画像をリサイズ・再エンコードする。

    長辺が `MAX_IMAGE_DIMENSION` を超える場合のみ、アスペクト比を保ったまま
    縮小し、JPEG(quality=`RESIZED_JPEG_QUALITY`)で再エンコードする。
    - 縮小不要な場合は元のバイト列・media_typeをそのまま返す。
    - Pillowでデコードできない画像(壊れたファイル等)の場合は、リサイズを
      諦めて元のバイト列・media_typeをそのまま返す(AI呼び出し自体は
      そのまま試みる)。

    保存用ファイル(`data/images/`)には影響しない。あくまでAI呼び出しに
    使うバイト列にのみ適用する。
    """

    from PIL import Image

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            width, height = img.size
            if max(width, height) <= MAX_IMAGE_DIMENSION:
                return image_bytes, media_type

            scale = MAX_IMAGE_DIMENSION / float(max(width, height))
            new_size = (max(1, round(width * scale)), max(1, round(height * scale)))

            resized = img.convert("RGB").resize(new_size, Image.LANCZOS)
            buffer = io.BytesIO()
            resized.save(buffer, format="JPEG", quality=RESIZED_JPEG_QUALITY)
            return buffer.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, media_type


def analyze_variety_image(image_bytes: bytes, media_type: str) -> str:
    """画像バイト列をAI Vision APIへ送信し、生のテキスト応答を返す。

    `ANTHROPIC_API_KEY` が設定されていればAnthropic Claude Vision APIを、
    そうでなく `AI_VISION_BASE_URL` が設定されていればOpenAI互換の
    ローカル/リモートサーバーを使用する(優先順位: Anthropic > ローカル)。

    呼び出し側(APIルーター)で `is_ai_configured()` による未設定チェックを
    済ませたうえで呼び出すこと。

    Args:
        image_bytes: 画像ファイルの生バイト列。
        media_type: "image/jpeg" 等のMIMEタイプ。

    Returns:
        AIからのテキスト応答(生テキスト)。
    """

    if os.getenv("ANTHROPIC_API_KEY"):
        return _analyze_with_anthropic(image_bytes, media_type)

    if os.getenv("AI_VISION_BASE_URL"):
        return _analyze_with_local_provider(image_bytes, media_type)

    # is_ai_configured() のチェックを経ずに呼ばれた場合の防御的エラー。
    raise RuntimeError(
        "ANTHROPIC_API_KEYまたはAI_VISION_BASE_URLが設定されていません"
    )


def _analyze_with_anthropic(image_bytes: bytes, media_type: str) -> str:
    """Anthropic Claude Vision APIへ画像を送信し、生のテキスト応答を返す。"""

    # importをここに置くことで、ANTHROPIC_API_KEY未設定時にAPIルーターを
    # 経由する通常のテスト実行時であってもAnthropicクライアントの初期化を
    # 遅延させる(モジュールimport時点でのクライアント生成を避ける)。
    from anthropic import Anthropic

    resized_bytes, resized_media_type = _resize_image_for_ai(image_bytes, media_type)

    client = Anthropic()
    message = client.messages.create(
        model=ANALYSIS_MODEL,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": resized_media_type,
                            "data": base64.standard_b64encode(resized_bytes).decode("ascii"),
                        },
                    },
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
    )

    text_parts = [
        block.text for block in message.content if getattr(block, "type", None) == "text"
    ]
    return "".join(text_parts)


def _resolve_local_model(base_url: str) -> str:
    """`AI_VISION_MODEL` が未設定の場合に `/models` から先頭のモデルIDを取得する。"""

    import httpx

    with httpx.Client(timeout=30) as http_client:
        response = http_client.get(f"{base_url}/models")
        response.raise_for_status()
        payload = response.json()

    models = payload.get("data") or []
    if not models or not models[0].get("id"):
        raise RuntimeError(
            "AI_VISION_MODELを設定してください(/modelsからの自動取得に失敗しました)"
        )
    return models[0]["id"]


def _analyze_with_local_provider(image_bytes: bytes, media_type: str) -> str:
    """OpenAI互換のローカル/リモートサーバー(llama.cpp server等)へ画像を送信する。"""

    import httpx

    base_url = os.environ["AI_VISION_BASE_URL"].rstrip("/")
    model = os.getenv("AI_VISION_MODEL") or _resolve_local_model(base_url)

    resized_bytes, resized_media_type = _resize_image_for_ai(image_bytes, media_type)
    data_url = (
        f"data:{resized_media_type};base64,"
        f"{base64.standard_b64encode(resized_bytes).decode('ascii')}"
    )

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "max_tokens": 1200,
        "temperature": 0.1,
    }

    # ローカルLLMの推論は数秒〜十数秒かかることがあるため、余裕をもって120秒。
    with httpx.Client(timeout=120) as http_client:
        response = http_client.post(f"{base_url}/chat/completions", json=payload)
        response.raise_for_status()
        result = response.json()

    return result["choices"][0]["message"]["content"]


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def parse_extracted_json(raw_text: str) -> dict:
    """AIの生テキスト応答から栽培情報のJSONオブジェクトを抽出してパースする。

    - ```json ... ``` のようなコードフェンスに包まれていても対応する。
    - フェンスが無く前後に説明文が混ざっている場合、最初の "{" 〜最後の "}" を
      抜き出して再度パースを試みる。
    - それでも失敗する場合は ValueError を送出する(呼び出し側で分かりやすい
      エラーメッセージに変換する想定)。
    """

    text = raw_text.strip()

    fence_match = _JSON_FENCE_RE.search(text)
    if fence_match:
        text = fence_match.group(1).strip()

    if not text:
        raise ValueError("AIの応答が空です")

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("AIの応答をJSONとして解析できませんでした") from None
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError("AIの応答をJSONとして解析できませんでした") from exc

    if not isinstance(data, dict):
        raise ValueError("AIの応答が期待したJSON形式(オブジェクト)ではありません")

    # ローカルLLMが数値フィールドを自然文で返すことがあるため、緩やかに
    # 型合わせを行う(タスク3: 例「開花後45〜50日」→ 数値抽出 + 元テキストを
    # protection_notesへ退避)。
    normalize_numeric_fields(data)

    return data
