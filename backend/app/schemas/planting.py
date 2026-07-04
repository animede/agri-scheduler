"""Planting（作付け）のPydanticスキーマ。"""

from __future__ import annotations

import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PlantingStatus = Literal["計画", "育苗中", "植付済", "収穫中", "完了"]


class PlantingBase(BaseModel):
    bed_segment_id: int
    variety_id: int
    year: int
    planned_sowing_date: datetime.date | None = None
    actual_sowing_date: datetime.date | None = None
    planned_transplant_date: datetime.date | None = None
    actual_transplant_date: datetime.date | None = None
    planned_harvest_start_date: datetime.date | None = None
    actual_harvest_start_date: datetime.date | None = None
    planned_harvest_end_date: datetime.date | None = None
    actual_harvest_end_date: datetime.date | None = None
    status: PlantingStatus = "計画"
    notes: str | None = None


class PlantingCreate(PlantingBase):
    pass


class PlantingUpdate(BaseModel):
    bed_segment_id: int | None = None
    variety_id: int | None = None
    year: int | None = None
    planned_sowing_date: datetime.date | None = None
    actual_sowing_date: datetime.date | None = None
    planned_transplant_date: datetime.date | None = None
    actual_transplant_date: datetime.date | None = None
    planned_harvest_start_date: datetime.date | None = None
    actual_harvest_start_date: datetime.date | None = None
    planned_harvest_end_date: datetime.date | None = None
    actual_harvest_end_date: datetime.date | None = None
    status: PlantingStatus | None = None
    notes: str | None = None


class PlantingResponse(PlantingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
