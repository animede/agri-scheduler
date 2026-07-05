"""Crop（作物）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.crop import Crop
from app.schemas.crop import CropCreate, CropResponse, CropUpdate

router = make_crud_router(
    model=Crop,
    create_schema=CropCreate,
    update_schema=CropUpdate,
    response_schema=CropResponse,
    prefix="/api/crops",
    tag="crops",
    not_found_detail="作物が見つかりません",
)
