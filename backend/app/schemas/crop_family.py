"""CropFamily（科マスタ）のPydanticスキーマ。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CropFamilyBase(BaseModel):
    name: str = Field(..., max_length=50)
    rotation_interval_years: int
    notes: str | None = None


class CropFamilyCreate(CropFamilyBase):
    pass


class CropFamilyUpdate(BaseModel):
    """PUTでの更新用。指定されたフィールドのみ更新する(部分更新可)。"""

    name: str | None = Field(default=None, max_length=50)
    rotation_interval_years: int | None = None
    notes: str | None = None


class CropFamilyResponse(CropFamilyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
