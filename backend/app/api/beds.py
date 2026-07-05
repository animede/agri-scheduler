"""Bed（畝）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.bed import Bed
from app.schemas.bed import BedCreate, BedResponse, BedUpdate

router = make_crud_router(
    model=Bed,
    create_schema=BedCreate,
    update_schema=BedUpdate,
    response_schema=BedResponse,
    prefix="/api/beds",
    tag="beds",
    not_found_detail="畝が見つかりません",
)
