"""Bed（畝）モデル。"""

from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    length_m: Mapped[float] = mapped_column(Float, nullable=False)
    width_cm: Mapped[float] = mapped_column(Float, nullable=False)
    orientation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pos_x: Mapped[float] = mapped_column(Float, nullable=False)
    pos_y: Mapped[float] = mapped_column(Float, nullable=False)

    field: Mapped["Field"] = relationship("Field", back_populates="beds")
    # 畝削除時は、内包する区画以下(区画→作付→作業)も連鎖して削除する。
    bed_segments: Mapped[list["BedSegment"]] = relationship(
        "BedSegment",
        back_populates="bed",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
