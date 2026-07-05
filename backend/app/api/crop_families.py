"""CropFamily（科マスタ）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.crop_family import CropFamily
from app.schemas.crop_family import CropFamilyCreate, CropFamilyResponse, CropFamilyUpdate

router = make_crud_router(
    model=CropFamily,
    create_schema=CropFamilyCreate,
    update_schema=CropFamilyUpdate,
    response_schema=CropFamilyResponse,
    prefix="/api/crop-families",
    tag="crop-families",
    not_found_detail="科マスタが見つかりません",
)
