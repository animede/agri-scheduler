"""Crop（作物）モデル。"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Crop(Base):
    __tablename__ = "crops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    crop_family_id: Mapped[int] = mapped_column(
        ForeignKey("crop_families.id"), nullable=False
    )

    crop_family: Mapped["CropFamily"] = relationship(
        "CropFamily", back_populates="crops"
    )
    # Cropはマスタデータのため、参照しているVarietyがある場合は削除させない
    varieties: Mapped[list["Variety"]] = relationship(
        "Variety", back_populates="crop"
    )
