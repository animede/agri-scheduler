"""Variety（品種）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.variety import Variety
from app.schemas.variety import VarietyCreate, VarietyResponse, VarietyUpdate

router = make_crud_router(
    model=Variety,
    create_schema=VarietyCreate,
    update_schema=VarietyUpdate,
    response_schema=VarietyResponse,
    prefix="/api/varieties",
    tag="varieties",
    not_found_detail="品種が見つかりません",
)
