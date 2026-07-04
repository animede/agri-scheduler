"""Planting（作付け）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.planting import Planting
from app.schemas.planting import PlantingCreate, PlantingResponse, PlantingUpdate

router = make_crud_router(
    model=Planting,
    create_schema=PlantingCreate,
    update_schema=PlantingUpdate,
    response_schema=PlantingResponse,
    prefix="/api/plantings",
    tag="plantings",
    not_found_detail="Planting not found",
)
