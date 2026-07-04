"""Task（作業）モデル。作付けに紐づく個別の作業タスク。"""

from __future__ import annotations

import datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    planting_id: Mapped[int] = mapped_column(
        ForeignKey("plantings.id", ondelete="CASCADE"), nullable=False
    )
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    planned_date_start: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    planned_date_end: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    actual_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    planting: Mapped["Planting"] = relationship("Planting", back_populates="tasks")
