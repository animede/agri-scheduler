"""BedSegment（区画）モデル。"""

from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class BedSegment(Base):
    __tablename__ = "bed_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bed_id: Mapped[int] = mapped_column(
        ForeignKey("beds.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    start_offset_m: Mapped[float] = mapped_column(Float, nullable=False)
    length_m: Mapped[float] = mapped_column(Float, nullable=False)

    bed: Mapped["Bed"] = relationship("Bed", back_populates="bed_segments")
    # 区画削除時は、当該区画の作付け以下(作付→作業)も連鎖して削除する。
    plantings: Mapped[list["Planting"]] = relationship(
        "Planting",
        back_populates="bed_segment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
