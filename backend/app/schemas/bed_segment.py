"""BedSegment（区画）のPydanticスキーマ。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class BedSegmentBase(BaseModel):
    bed_id: int
    name: str | None = Field(default=None, max_length=100)
    start_offset_m: float
    length_m: float


class BedSegmentCreate(BedSegmentBase):
    pass


class BedSegmentUpdate(BaseModel):
    bed_id: int | None = None
    name: str | None = Field(default=None, max_length=100)
    start_offset_m: float | None = None
    length_m: float | None = None


class BedSegmentResponse(BedSegmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
