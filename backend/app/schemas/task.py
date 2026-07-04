"""Task（作業）のPydanticスキーマ。"""

from __future__ import annotations

import datetime

from pydantic import BaseModel, ConfigDict, Field


class TaskBase(BaseModel):
    planting_id: int
    task_type: str = Field(..., max_length=50)
    planned_date_start: datetime.date | None = None
    planned_date_end: datetime.date | None = None
    actual_date: datetime.date | None = None
    is_completed: bool = False
    notes: str | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    planting_id: int | None = None
    task_type: str | None = Field(default=None, max_length=50)
    planned_date_start: datetime.date | None = None
    planned_date_end: datetime.date | None = None
    actual_date: datetime.date | None = None
    is_completed: bool | None = None
    notes: str | None = None


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
