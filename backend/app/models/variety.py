"""Variety（品種）モデル。"""

from __future__ import annotations

import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Variety(Base):
    __tablename__ = "varieties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    crop_id: Mapped[int] = mapped_column(ForeignKey("crops.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # 地域帯別(寒地/温暖地/暖地)の栽培暦。Phase1では自由入力可能なJSONとして格納する。
    # 例: {"cold": {"sowing": "3月上旬〜4月上旬", ...}, "temperate": {...}, "warm": {...}}
    cultivation_calendar: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    seedling_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    days_to_harvest: Mapped[int | None] = mapped_column(Integer, nullable=True)
    plant_spacing_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    row_spacing_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    mulch_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    protection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Phase6(AI画像解析)で使用するカラム。Phase1では未使用だが定義のみ用意する。
    source_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ai_extracted_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    crop: Mapped["Crop"] = relationship("Crop", back_populates="varieties")
    # Varietyはマスタデータのため、参照しているPlantingがある場合は削除させない
    plantings: Mapped[list["Planting"]] = relationship(
        "Planting", back_populates="variety"
    )
