"""Field（圃場）のPydanticスキーマ。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FieldBase(BaseModel):
    name: str = Field(..., max_length=100)
    location_note: str | None = Field(default=None, max_length=255)
    area_sqm: float | None = None


class FieldCreate(FieldBase):
    pass


class FieldUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    location_note: str | None = Field(default=None, max_length=255)
    area_sqm: float | None = None


class FieldResponse(FieldBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
