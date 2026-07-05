"""実際のdata/imagesディレクトリを介した静的配信の疎通確認。

test_ai_analysis.py内のテストは保存先ディレクトリをtmp_pathに差し替えて
ロジックのみを検証しているため、ここでは差し替えを行わず、
本番と同じ `data/images/` ディレクトリ ( app.main でマウントされる場所)に
実際に保存し、`/static/images/<filename>` から取得できることを確認する。
テスト終了後は作成したファイルを削除し、リポジトリを汚さないようにする。
"""

from __future__ import annotations

import base64

import app.api.ai_analysis as ai_analysis_module

_MINIMAL_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
MINIMAL_PNG_BYTES = base64.b64decode(_MINIMAL_PNG_B64)


def test_uploaded_image_is_served_via_static_route(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy-key-for-test")
    monkeypatch.setattr(
        ai_analysis_module,
        "analyze_variety_image",
        lambda image_bytes, media_type: '{"seedling_days": 30}',
    )

    resp = client.post(
        "/api/ai/analyze-variety-image",
        files={"file": ("real_dir_test.png", MINIMAL_PNG_BYTES, "image/png")},
    )
    assert resp.status_code == 200
    image_path = resp.json()["image_path"]
    assert image_path.startswith("images/")

    saved_file = ai_analysis_module.IMAGES_DIR / image_path.removeprefix("images/")
    try:
        static_resp = client.get(f"/static/{image_path}")
        assert static_resp.status_code == 200
        assert static_resp.content == MINIMAL_PNG_BYTES
    finally:
        saved_file.unlink(missing_ok=True)
