"""CropFamily（科マスタ）モデル。輪作年限判定の基準となる。"""

from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class CropFamily(Base):
    __tablename__ = "crop_families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    rotation_interval_years: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # CropFamilyはマスタデータのため、参照しているCropが存在する場合は削除させない
    # (cascadeは付けず、DB側でのFK制約違反をAPI層で捕捉してエラーとする)
    crops: Mapped[list["Crop"]] = relationship("Crop", back_populates="crop_family")
