"""種苗会社画像のAI解析API(Phase 6, spec.md 4.3)。

`POST /api/ai/analyze-variety-image` で種苗パッケージ画像をアップロードすると、
- 画像を `data/images/` に一意なファイル名で保存し
- Anthropic Claude Vision APIに渡して栽培暦等を構造化データとして抽出し
- 抽出結果(JSON)と生テキスト応答をフロントエンドへ返す

`analyze_variety_image` (Anthropic API本体の呼び出し)は `app.services.ai_vision`
に分離しており、本モジュールではそれを呼び出すだけにする。これにより、
ユニットテストでは本モジュールの `analyze_variety_image` をモックすることで、
実際のAPIキー/ネットワークが無くても保存・レスポンス組み立て・エラー処理を
検証できる。
"""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.ai_vision import (
    SUPPORTED_MEDIA_TYPES,
    analyze_variety_image,
    is_ai_configured,
    parse_extracted_json,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# backend/app/api/ai_analysis.py から見て ../../../data/images が
# プロジェクトルートの data/images (app/db.py と同様の相対パス解決方法)。
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
IMAGES_DIR = PROJECT_ROOT / "data" / "images"

# アップロードファイルのcontent_typeから保存拡張子を決める対応表。
_EXTENSION_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


class AnalyzeVarietyImageResponse(BaseModel):
    image_path: str
    extracted: dict
    raw_response: str


def _resolve_extension(upload: UploadFile) -> str:
    content_type = upload.content_type or ""
    ext = _EXTENSION_BY_CONTENT_TYPE.get(content_type)
    if ext:
        return ext
    # content_typeから判別できない場合は元のファイル名の拡張子を使う
    suffix = Path(upload.filename or "").suffix
    return suffix if suffix else ".bin"


@router.post("/analyze-variety-image", response_model=AnalyzeVarietyImageResponse)
async def analyze_variety_image_endpoint(
    file: UploadFile = File(...),
) -> AnalyzeVarietyImageResponse:
    if not is_ai_configured():
        raise HTTPException(
            status_code=503,
            detail="AI画像解析キーが設定されていません。手動で入力してください。",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="画像ファイルが空です")

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    ext = _resolve_extension(file)
    filename = f"{uuid.uuid4().hex}{ext}"
    (IMAGES_DIR / filename).write_bytes(image_bytes)
    # DBには相対パスを保存する(配信URLは呼び出し側で組み立てる: /static/images/xxx)。
    image_path = f"images/{filename}"

    media_type = (
        file.content_type if file.content_type in SUPPORTED_MEDIA_TYPES else "image/jpeg"
    )

    try:
        raw_response = analyze_variety_image(image_bytes, media_type)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI画像解析の呼び出しに失敗しました: {exc}",
        ) from exc

    try:
        extracted = parse_extracted_json(raw_response)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="AIの応答を解析できませんでした",
        ) from None

    return AnalyzeVarietyImageResponse(
        image_path=image_path,
        extracted=extracted,
        raw_response=raw_response,
    )
