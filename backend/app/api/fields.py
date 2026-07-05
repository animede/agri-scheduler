"""Field（圃場）CRUD API。"""

from __future__ import annotations

from app.api.crud_router import make_crud_router
from app.models.field import Field
from app.schemas.field import FieldCreate, FieldResponse, FieldUpdate

router = make_crud_router(
    model=Field,
    create_schema=FieldCreate,
    update_schema=FieldUpdate,
    response_schema=FieldResponse,
    prefix="/api/fields",
    tag="fields",
    not_found_detail="圃場が見つかりません",
)
