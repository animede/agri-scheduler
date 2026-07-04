"""Bed（畝）のPydanticスキーマ。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class BedBase(BaseModel):
    field_id: int
    name: str = Field(..., max_length=100)
    length_m: float
    width_cm: float
    orientation: str | None = Field(default=None, max_length=50)
    pos_x: float
    pos_y: float


class BedCreate(BedBase):
    pass


class BedUpdate(BaseModel):
    field_id: int | None = None
    name: str | None = Field(default=None, max_length=100)
    length_m: float | None = None
    width_cm: float | None = None
    orientation: str | None = Field(default=None, max_length=50)
    pos_x: float | None = None
    pos_y: float | None = None


class BedResponse(BedBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
