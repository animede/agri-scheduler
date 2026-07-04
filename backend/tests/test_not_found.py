"""存在しないIDへのGET/PUT/DELETEが404を返すことの確認。"""

from __future__ import annotations

import pytest

NON_EXISTENT_ID = 999_999_999

RESOURCES_WITH_UPDATE_PAYLOAD = [
    ("/api/crop-families", {"notes": "更新テスト"}),
    ("/api/crops", {"name": "更新テスト"}),
    ("/api/varieties", {"name": "更新テスト"}),
    ("/api/fields", {"name": "更新テスト"}),
    ("/api/beds", {"name": "更新テスト"}),
    ("/api/bed-segments", {"name": "更新テスト"}),
    ("/api/plantings", {"notes": "更新テスト"}),
    ("/api/tasks", {"notes": "更新テスト"}),
]


@pytest.mark.parametrize("prefix,payload", RESOURCES_WITH_UPDATE_PAYLOAD)
def test_get_not_found(client, prefix, payload):
    resp = client.get(f"{prefix}/{NON_EXISTENT_ID}")
    assert resp.status_code == 404


@pytest.mark.parametrize("prefix,payload", RESOURCES_WITH_UPDATE_PAYLOAD)
def test_put_not_found(client, prefix, payload):
    resp = client.put(f"{prefix}/{NON_EXISTENT_ID}", json=payload)
    assert resp.status_code == 404


@pytest.mark.parametrize("prefix,payload", RESOURCES_WITH_UPDATE_PAYLOAD)
def test_delete_not_found(client, prefix, payload):
    resp = client.delete(f"{prefix}/{NON_EXISTENT_ID}")
    assert resp.status_code == 404
