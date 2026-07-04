"""Field（圃場）モデル。"""

from __future__ import annotations

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    location_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)

    # 圃場削除時は、内包する畝以下(畝→区画→作付→作業)も連鎖して削除する。
    beds: Mapped[list["Bed"]] = relationship(
        "Bed",
        back_populates="field",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
