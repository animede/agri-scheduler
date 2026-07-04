"""マスタデータ(CropFamily/Crop/Variety)は参照されている間は削除できないことの確認。"""

from __future__ import annotations


def test_cannot_delete_crop_family_in_use(client):
    families = client.get("/api/crop-families").json()
    family = next(f for f in families if f["name"] == "ウリ科")

    crop = client.post(
        "/api/crops", json={"name": "キュウリ", "crop_family_id": family["id"]}
    ).json()

    resp = client.delete(f"/api/crop-families/{family['id']}")
    assert resp.status_code == 400

    # クリーンアップ: 参照を外してから削除できることも確認
    resp = client.delete(f"/api/crops/{crop['id']}")
    assert resp.status_code == 204
    resp = client.delete(f"/api/crop-families/{family['id']}")
    assert resp.status_code == 204

    # 後続テストに影響しないよう、マスタデータを復元しておく
    client.post(
        "/api/crop-families",
        json={"name": "ウリ科", "rotation_interval_years": 3},
    )
