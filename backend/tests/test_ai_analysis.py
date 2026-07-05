"""Phase6 AI画像解析API(`/api/ai/analyze-variety-image`)のテスト。

`app.services.ai_vision.analyze_variety_image`（Anthropic API本体の呼び出し）は
実際のAPIキー/ネットワークが無い開発環境でも検証できるよう、常にモックする。
検証観点:
  (a) ANTHROPIC_API_KEY未設定時に503が返ること
  (b) 画像の保存・静的配信(/static/images/...)が実際に動くこと
  (c) Anthropicからの生テキストをJSONにパースするロジックが正しく動くこと
      (コードフェンス付き応答/不正な応答を含む)
"""

from __future__ import annotations

import base64

import app.api.ai_analysis as ai_analysis_module

# 1x1の最小PNG画像(黒1ピクセル)。Pillow等の画像ライブラリに依存せず
# 用意できる、実際にデコード可能な最小のPNGバイト列。
_MINIMAL_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
MINIMAL_PNG_BYTES = base64.b64decode(_MINIMAL_PNG_B64)


def _post_image(client, filename: str = "seed_pack.png", content_type: str = "image/png"):
    return client.post(
        "/api/ai/analyze-variety-image",
        files={"file": (filename, MINIMAL_PNG_BYTES, content_type)},
    )


def test_missing_api_key_returns_503(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("AI_VISION_BASE_URL", raising=False)

    resp = _post_image(client)

    assert resp.status_code == 503
    assert resp.json()["detail"] == "AI画像解析キーが設定されていません。手動で入力してください。"


def test_analyze_success_saves_image_and_serves_static(client, monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy-key-for-test")
    monkeypatch.setattr(ai_analysis_module, "IMAGES_DIR", tmp_path)

    raw_response = """ここに前置きが入ることがあります。
```json
{
  "cultivation_calendar": {
    "temperate": {"sowing": "3月上旬〜4月上旬", "transplanting": "5月上旬", "harvest": "7月〜8月"}
  },
  "seedling_days": 60,
  "days_to_harvest": 90,
  "plant_spacing_cm": 45,
  "row_spacing_cm": 60,
  "mulch_type": "黒マルチ",
  "protection_notes": "植え付け後2週間はべたがけ"
}
```
"""

    def fake_analyze(image_bytes: bytes, media_type: str) -> str:
        assert image_bytes == MINIMAL_PNG_BYTES
        assert media_type == "image/png"
        return raw_response

    monkeypatch.setattr(ai_analysis_module, "analyze_variety_image", fake_analyze)

    resp = _post_image(client)

    assert resp.status_code == 200
    body = resp.json()
    assert body["image_path"].startswith("images/")
    assert body["image_path"].endswith(".png")
    assert body["raw_response"] == raw_response
    extracted = body["extracted"]
    assert extracted["cultivation_calendar"]["temperate"]["harvest"] == "7月〜8月"
    assert extracted["seedling_days"] == 60
    assert extracted["mulch_type"] == "黒マルチ"

    saved_files = list(tmp_path.iterdir())
    assert len(saved_files) == 1
    assert saved_files[0].read_bytes() == MINIMAL_PNG_BYTES

    # 静的配信(/static/images/xxx)で保存した画像が取得できることを確認する。
    # NOTE: main.py起動時にマウントされるのは実プロジェクトの data/images
    # ディレクトリなので、静的配信自体の疎通確認は別途 test_static_images.py で行う。


def test_analyze_invalid_json_response_returns_clear_error(client, monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy-key-for-test")
    monkeypatch.setattr(ai_analysis_module, "IMAGES_DIR", tmp_path)
    monkeypatch.setattr(
        ai_analysis_module,
        "analyze_variety_image",
        lambda image_bytes, media_type: "申し訳ありませんが、画像の内容を読み取れませんでした。",
    )

    resp = _post_image(client)

    assert resp.status_code == 422
    assert resp.json()["detail"] == "AIの応答を解析できませんでした"


def test_analyze_upstream_error_returns_502(client, monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy-key-for-test")
    monkeypatch.setattr(ai_analysis_module, "IMAGES_DIR", tmp_path)

    def raise_error(image_bytes: bytes, media_type: str) -> str:
        raise RuntimeError("network unreachable")

    monkeypatch.setattr(ai_analysis_module, "analyze_variety_image", raise_error)

    resp = _post_image(client)

    assert resp.status_code == 502
    assert "AI画像解析の呼び出しに失敗しました" in resp.json()["detail"]


def test_empty_file_returns_400(client, monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy-key-for-test")
    monkeypatch.setattr(ai_analysis_module, "IMAGES_DIR", tmp_path)

    resp = client.post(
        "/api/ai/analyze-variety-image",
        files={"file": ("empty.png", b"", "image/png")},
    )

    assert resp.status_code == 400
