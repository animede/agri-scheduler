"""初期マスタデータ投入。

CropFamily（科マスタ）の初期データをアプリ起動時に冪等に投入する。
既に同名のCropFamilyが存在する場合は投入しない。
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.crop_family import CropFamily

# 仕様書 4.2 に記載の初期マスタ例。輪作年限は範囲表記(例: 3-4年)の場合、
# より安全側(長い方)の年数をデフォルト値として採用する。
INITIAL_CROP_FAMILIES: list[dict[str, object]] = [
    {"name": "ナス科", "rotation_interval_years": 4, "notes": None},
    {"name": "ウリ科", "rotation_interval_years": 3, "notes": None},
    {"name": "アブラナ科", "rotation_interval_years": 2, "notes": None},
    {"name": "マメ科", "rotation_interval_years": 3, "notes": None},
    {"name": "セリ科", "rotation_interval_years": 2, "notes": None},
    {"name": "キク科", "rotation_interval_years": 2, "notes": None},
    {"name": "ヒガンバナ科", "rotation_interval_years": 1, "notes": None},
    {"name": "ヒユ科", "rotation_interval_years": 1, "notes": None},
]


def seed_crop_families(db: Session) -> None:
    """CropFamily初期マスタを冪等に投入する。"""

    existing_names = {name for (name,) in db.query(CropFamily.name).all()}
    for data in INITIAL_CROP_FAMILIES:
        if data["name"] in existing_names:
            continue
        db.add(CropFamily(**data))
    db.commit()
