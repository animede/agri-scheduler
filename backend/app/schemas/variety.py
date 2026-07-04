"""Variety（品種）のPydanticスキーマ。"""

from __future__ import annotations

import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class VarietyBase(BaseModel):
    crop_id: int
    name: str = Field(..., max_length=100)
    cultivation_calendar: dict[str, Any] | None = None
    seedling_days: int | None = None
    days_to_harvest: int | None = None
    plant_spacing_cm: float | None = None
    row_spacing_cm: float | None = None
    mulch_type: str | None = Field(default=None, max_length=50)
    protection_notes: str | None = None
    source_image_path: str | None = Field(default=None, max_length=500)
    ai_extracted_data: dict[str, Any] | None = None


class VarietyCreate(VarietyBase):
    pass


class VarietyUpdate(BaseModel):
    crop_id: int | None = None
    name: str | None = Field(default=None, max_length=100)
    cultivation_calendar: dict[str, Any] | None = None
    seedling_days: int | None = None
    days_to_harvest: int | None = None
    plant_spacing_cm: float | None = None
    row_spacing_cm: float | None = None
    mulch_type: str | None = Field(default=None, max_length=50)
    protection_notes: str | None = None
    source_image_path: str | None = Field(default=None, max_length=500)
    ai_extracted_data: dict[str, Any] | None = None


class VarietyResponse(VarietyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
