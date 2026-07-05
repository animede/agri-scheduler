"""BedSegment（区画）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.bed_segment import BedSegment
from app.schemas.bed_segment import BedSegmentCreate, BedSegmentResponse, BedSegmentUpdate

router = make_crud_router(
    model=BedSegment,
    create_schema=BedSegmentCreate,
    update_schema=BedSegmentUpdate,
    response_schema=BedSegmentResponse,
    prefix="/api/bed-segments",
    tag="bed-segments",
    not_found_detail="区画が見つかりません",
)
