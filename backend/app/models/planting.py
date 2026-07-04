"""Planting（作付け）モデル。区画×品種×年の計画・実績。"""

from __future__ import annotations

import datetime

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# 作付けステータス（仕様上想定される値。DBレベルではCHECK制約を設けずAPI(schemas)側でバリデーションする）
PLANTING_STATUSES = ("計画", "育苗中", "植付済", "収穫中", "完了")


class Planting(Base):
    __tablename__ = "plantings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bed_segment_id: Mapped[int] = mapped_column(
        ForeignKey("bed_segments.id", ondelete="CASCADE"), nullable=False
    )
    variety_id: Mapped[int] = mapped_column(
        ForeignKey("varieties.id"), nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    planned_sowing_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    actual_sowing_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    planned_transplant_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    actual_transplant_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    planned_harvest_start_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    actual_harvest_start_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    planned_harvest_end_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    actual_harvest_end_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="計画")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    bed_segment: Mapped["BedSegment"] = relationship(
        "BedSegment", back_populates="plantings"
    )
    # Varietyはマスタデータ側なので back_populates のみ(cascadeは設定しない)
    variety: Mapped["Variety"] = relationship("Variety", back_populates="plantings")
    # 作付け削除時は、紐づく作業(Task)も連鎖して削除する。
    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="planting",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
