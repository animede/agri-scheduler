"""Crop（作物）のPydanticスキーマ。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CropBase(BaseModel):
    name: str = Field(..., max_length=100)
    crop_family_id: int


class CropCreate(CropBase):
    pass


class CropUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    crop_family_id: int | None = None


class CropResponse(CropBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
