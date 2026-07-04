"""Field→Bed→BedSegment→Variety(Crop経由)→Planting→Taskの一気通貫作成テスト。"""

from __future__ import annotations


def test_full_creation_flow(client):
    # 1. CropFamilyは初期マスタから1件取得(ナス科)
    families = client.get("/api/crop-families").json()
    nasu_family = next(f for f in families if f["name"] == "ナス科")

    # 2. Crop作成
    resp = client.post(
        "/api/crops", json={"name": "トマト", "crop_family_id": nasu_family["id"]}
    )
    assert resp.status_code == 201
    crop = resp.json()
    assert crop["name"] == "トマト"

    # 3. Variety作成
    resp = client.post(
        "/api/varieties",
        json={
            "crop_id": crop["id"],
            "name": "桃太郎",
            "cultivation_calendar": {
                "temperate": {
                    "sowing": "3月上旬〜4月上旬",
                    "transplanting": "5月中旬〜6月上旬",
                    "harvest": "7月〜9月",
                }
            },
            "seedling_days": 60,
            "days_to_harvest": 100,
            "plant_spacing_cm": 45.0,
            "row_spacing_cm": 90.0,
            "mulch_type": "黒マルチ",
        },
    )
    assert resp.status_code == 201
    variety = resp.json()
    assert variety["name"] == "桃太郎"
    assert variety["cultivation_calendar"]["temperate"]["harvest"] == "7月〜9月"
    assert "created_at" in variety and "updated_at" in variety

    # 4. Field作成
    resp = client.post(
        "/api/fields", json={"name": "第一圃場", "location_note": "自宅裏", "area_sqm": 120.5}
    )
    assert resp.status_code == 201
    field = resp.json()

    # 5. Bed作成
    resp = client.post(
        "/api/beds",
        json={
            "field_id": field["id"],
            "name": "畝1",
            "length_m": 10.0,
            "width_cm": 80.0,
            "orientation": "南北",
            "pos_x": 0.0,
            "pos_y": 0.0,
        },
    )
    assert resp.status_code == 201
    bed = resp.json()

    # 6. BedSegment作成
    resp = client.post(
        "/api/bed-segments",
        json={"bed_id": bed["id"], "name": "区画A", "start_offset_m": 0.0, "length_m": 5.0},
    )
    assert resp.status_code == 201
    segment = resp.json()

    # 7. Planting作成
    resp = client.post(
        "/api/plantings",
        json={
            "bed_segment_id": segment["id"],
            "variety_id": variety["id"],
            "year": 2026,
            "planned_sowing_date": "2026-03-15",
            "planned_transplant_date": "2026-05-20",
            "status": "計画",
        },
    )
    assert resp.status_code == 201
    planting = resp.json()
    assert planting["status"] == "計画"
    assert planting["bed_segment_id"] == segment["id"]
    assert planting["variety_id"] == variety["id"]

    # 8. Task作成
    resp = client.post(
        "/api/tasks",
        json={
            "planting_id": planting["id"],
            "task_type": "土作り",
            "planned_date_start": "2026-03-01",
            "planned_date_end": "2026-03-10",
        },
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["planting_id"] == planting["id"]
    assert task["is_completed"] is False

    # 9. 作成したPlantingがGETで取得できること
    resp = client.get(f"/api/plantings/{planting['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == planting["id"]

    # 10. 一覧にも反映されていること
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    assert any(t["id"] == task["id"] for t in resp.json())


def test_update_and_delete_flow(client):
    resp = client.post("/api/fields", json={"name": "更新削除テスト圃場"})
    field = resp.json()

    resp = client.put(f"/api/fields/{field['id']}", json={"area_sqm": 50.0})
    assert resp.status_code == 200
    assert resp.json()["area_sqm"] == 50.0
    assert resp.json()["name"] == "更新削除テスト圃場"  # 未指定フィールドは保持される

    resp = client.delete(f"/api/fields/{field['id']}")
    assert resp.status_code == 204

    resp = client.get(f"/api/fields/{field['id']}")
    assert resp.status_code == 404


def test_cascade_delete_field_removes_descendants():
    """Field削除→Bed→BedSegment→Planting→Taskが連鎖して削除されること。"""

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        families = c.get("/api/crop-families").json()
        family_id = families[0]["id"]
        crop = c.post(
            "/api/crops", json={"name": "カスケード用作物", "crop_family_id": family_id}
        ).json()
        variety = c.post(
            "/api/varieties", json={"crop_id": crop["id"], "name": "カスケード用品種"}
        ).json()
        field = c.post("/api/fields", json={"name": "カスケード圃場"}).json()
        bed = c.post(
            "/api/beds",
            json={
                "field_id": field["id"],
                "name": "畝X",
                "length_m": 5.0,
                "width_cm": 60.0,
                "pos_x": 1.0,
                "pos_y": 1.0,
            },
        ).json()
        segment = c.post(
            "/api/bed-segments",
            json={"bed_id": bed["id"], "start_offset_m": 0.0, "length_m": 5.0},
        ).json()
        planting = c.post(
            "/api/plantings",
            json={"bed_segment_id": segment["id"], "variety_id": variety["id"], "year": 2026},
        ).json()
        task = c.post(
            "/api/tasks", json={"planting_id": planting["id"], "task_type": "収穫"}
        ).json()

        resp = c.delete(f"/api/fields/{field['id']}")
        assert resp.status_code == 204

        assert c.get(f"/api/beds/{bed['id']}").status_code == 404
        assert c.get(f"/api/bed-segments/{segment['id']}").status_code == 404
        assert c.get(f"/api/plantings/{planting['id']}").status_code == 404
        assert c.get(f"/api/tasks/{task['id']}").status_code == 404

        # Varietyはマスタデータなので削除されずに残っている
        assert c.get(f"/api/varieties/{variety['id']}").status_code == 200
