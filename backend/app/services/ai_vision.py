"""Anthropic Claude Vision APIを用いた種苗パッケージ画像解析(Phase 6)。

spec.md 4.3「種苗会社画像のAI解析」に対応する。Anthropic APIへの実際の
通信部分をここに分離することで、
- APIルーター(`app/api/ai_analysis.py`)からは `analyze_variety_image` を
  呼ぶだけにする
- ユニットテストからは `analyze_variety_image` をモックし、実際にAPIキーや
  ネットワークが無い環境でもルーターのロジック(保存/レスポンス組み立て/
  エラーハンドリング)を検証できるようにする

という2点を満たす。
"""

from __future__ import annotations

import base64
import json
import os
import re

# spec.md 7章「推奨技術構成」に記載のモデルID。
ANALYSIS_MODEL = "claude-sonnet-5"

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
    """ANTHROPIC_API_KEYが環境変数に設定されているかどうかを返す。"""

    return bool(os.getenv("ANTHROPIC_API_KEY"))


def analyze_variety_image(image_bytes: bytes, media_type: str) -> str:
    """画像バイト列をAnthropic Claude Vision APIへ送信し、生のテキスト応答を返す。

    呼び出し側(APIルーター)で `is_ai_configured()` によるAPIキー未設定チェックを
    済ませたうえで呼び出すこと。この関数自体はAPIキー未設定時の挙動を関知しない
    (Anthropicクライアントがエラーを送出する)。

    Args:
        image_bytes: 画像ファイルの生バイト列。
        media_type: "image/jpeg" 等のMIMEタイプ。

    Returns:
        Anthropicからのテキスト応答(生テキスト)。
    """

    # importをここに置くことで、ANTHROPIC_API_KEY未設定時にAPIルーターを
    # 経由する通常のテスト実行時であってもAnthropicクライアントの初期化を
    # 遅延させる(モジュールimport時点でのクライアント生成を避ける)。
    from anthropic import Anthropic

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
                            "media_type": media_type,
                            "data": base64.standard_b64encode(image_bytes).decode("ascii"),
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

    return data
