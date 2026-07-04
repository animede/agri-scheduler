"""CropFamily初期マスタデータの投入確認。"""

from __future__ import annotations

EXPECTED_NAMES = {
    "ナス科",
    "ウリ科",
    "アブラナ科",
    "マメ科",
    "セリ科",
    "キク科",
    "ヒガンバナ科",
    "ヒユ科",
}


def test_initial_crop_families_seeded(client):
    resp = client.get("/api/crop-families")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 8
    assert {item["name"] for item in data} == EXPECTED_NAMES

    nasu = next(item for item in data if item["name"] == "ナス科")
    assert nasu["rotation_interval_years"] == 4


def test_seed_is_idempotent(client):
    """seed処理を再度呼んでも重複投入されないこと(lifespanは1回だがロジックとして確認)。"""

    from app.db import SessionLocal
    from app.seed import seed_crop_families

    db = SessionLocal()
    try:
        seed_crop_families(db)
    finally:
        db.close()

    resp = client.get("/api/crop-families")
    assert resp.status_code == 200
    assert len(resp.json()) == 8
