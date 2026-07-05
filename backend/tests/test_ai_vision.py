"""`app.services.ai_vision.parse_extracted_json` の単体テスト。

Anthropicからの生テキスト応答は
  - 素のJSONのみ
  - ```json ... ``` のコードフェンスに包まれている
  - 前後に説明文が混ざっている
  - JSONとして解釈不能
のいずれのパターンもあり得るため、それぞれ検証する。
"""

from __future__ import annotations

import io

import pytest

from app.services import ai_vision
from app.services.ai_vision import (
    MAX_IMAGE_DIMENSION,
    _resize_image_for_ai,
    analyze_variety_image,
    is_ai_configured,
    parse_extracted_json,
)
from app.services.extraction_normalize import normalize_numeric_fields


def test_parse_plain_json():
    raw = '{"seedling_days": 60, "mulch_type": "黒マルチ"}'
    data = parse_extracted_json(raw)
    assert data == {"seedling_days": 60, "mulch_type": "黒マルチ"}


def test_parse_json_wrapped_in_code_fence():
    raw = """```json
{
  "cultivation_calendar": {"temperate": {"sowing": "3月"}},
  "days_to_harvest": 90
}
```"""
    data = parse_extracted_json(raw)
    assert data["days_to_harvest"] == 90
    assert data["cultivation_calendar"]["temperate"]["sowing"] == "3月"


def test_parse_json_with_surrounding_text_and_no_fence():
    raw = '以下が抽出結果です:\n{"plant_spacing_cm": 45}\nご確認ください。'
    data = parse_extracted_json(raw)
    assert data["plant_spacing_cm"] == 45


def test_parse_invalid_text_raises_value_error():
    with pytest.raises(ValueError):
        parse_extracted_json("画像から情報を読み取れませんでした。")


def test_parse_non_object_json_raises_value_error():
    with pytest.raises(ValueError):
        parse_extracted_json("[1, 2, 3]")


def test_parse_empty_text_raises_value_error():
    with pytest.raises(ValueError):
        parse_extracted_json("   ")


# --- タスク3: 数値フィールドの緩い型合わせ ---------------------------------


def test_normalize_numeric_fields_converts_natural_language_string():
    data = {"days_to_harvest": "開花後45〜50日", "protection_notes": None}
    normalize_numeric_fields(data)

    assert data["days_to_harvest"] == 45
    assert data["protection_notes"] == "収穫までの目安: 開花後45〜50日"


def test_normalize_numeric_fields_appends_to_existing_notes():
    data = {
        "plant_spacing_cm": "約60cm前後",
        "protection_notes": "植え付け後2週間はべたがけ",
    }
    normalize_numeric_fields(data)

    assert data["plant_spacing_cm"] == 60
    assert data["protection_notes"] == (
        "植え付け後2週間はべたがけ\n株間の目安: 約60cm前後"
    )


def test_normalize_numeric_fields_sets_null_when_no_number_found():
    data = {"row_spacing_cm": "生育状況による"}
    normalize_numeric_fields(data)

    assert data["row_spacing_cm"] is None
    assert data["protection_notes"] == "条間の目安: 生育状況による"


def test_normalize_numeric_fields_leaves_numeric_values_untouched():
    data = {"seedling_days": 60, "days_to_harvest": None}
    normalize_numeric_fields(data)

    assert data["seedling_days"] == 60
    assert data["days_to_harvest"] is None
    assert "protection_notes" not in data


def test_parse_extracted_json_normalizes_via_full_pipeline():
    raw = '{"days_to_harvest": "開花後45〜50日", "seedling_days": 60}'
    data = parse_extracted_json(raw)

    assert data["days_to_harvest"] == 45
    assert data["seedling_days"] == 60
    assert data["protection_notes"] == "収穫までの目安: 開花後45〜50日"


# --- タスク1: マルチプロバイダー選択 ---------------------------------------


def test_is_ai_configured_false_when_neither_set(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("AI_VISION_BASE_URL", raising=False)

    assert is_ai_configured() is False


def test_is_ai_configured_true_for_local_base_url(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("AI_VISION_BASE_URL", "http://127.0.0.1:64650/v1")

    assert is_ai_configured() is True


def test_analyze_variety_image_prefers_anthropic_when_both_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy")
    monkeypatch.setenv("AI_VISION_BASE_URL", "http://127.0.0.1:64650/v1")

    calls = []
    monkeypatch.setattr(
        ai_vision, "_analyze_with_anthropic", lambda b, m: calls.append("anthropic") or "ok"
    )
    monkeypatch.setattr(
        ai_vision, "_analyze_with_local_provider", lambda b, m: calls.append("local") or "ok"
    )

    result = analyze_variety_image(b"fake", "image/jpeg")

    assert result == "ok"
    assert calls == ["anthropic"]


def test_analyze_variety_image_uses_local_provider_when_no_anthropic_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("AI_VISION_BASE_URL", "http://127.0.0.1:64650/v1")

    calls = []
    monkeypatch.setattr(
        ai_vision, "_analyze_with_local_provider", lambda b, m: calls.append("local") or "ok"
    )

    result = analyze_variety_image(b"fake", "image/jpeg")

    assert result == "ok"
    assert calls == ["local"]


def test_analyze_variety_image_raises_when_unconfigured(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("AI_VISION_BASE_URL", raising=False)

    with pytest.raises(RuntimeError):
        analyze_variety_image(b"fake", "image/jpeg")


def test_local_provider_calls_expected_endpoint_and_payload(monkeypatch):
    """`_analyze_with_local_provider` がOpenAI互換の /chat/completions を
    期待した形式(image_urlにdata:URLを含むcontentブロック)で呼び出すことを、
    httpx.Client をフェイクに差し替えて検証する。
    """

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("AI_VISION_BASE_URL", "http://127.0.0.1:64650/v1")
    monkeypatch.setenv("AI_VISION_MODEL", "test-model")

    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": '{"seedling_days": 60}'}}]}

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, *exc_info):
            return False

        def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    import httpx

    monkeypatch.setattr(httpx, "Client", FakeClient)

    result = analyze_variety_image(b"\x89PNG fake bytes not really an image", "image/png")

    assert result == '{"seedling_days": 60}'
    assert captured["url"] == "http://127.0.0.1:64650/v1/chat/completions"
    body = captured["json"]
    assert body["model"] == "test-model"
    content_blocks = body["messages"][0]["content"]
    assert content_blocks[0]["type"] == "text"
    image_block = content_blocks[1]
    assert image_block["type"] == "image_url"
    assert image_block["image_url"]["url"].startswith("data:image/png;base64,")


def test_local_provider_auto_detects_model_when_unset(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("AI_VISION_BASE_URL", "http://127.0.0.1:64650/v1")
    monkeypatch.delenv("AI_VISION_MODEL", raising=False)

    class FakeGetResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"id": "auto-detected-model"}]}

    class FakePostResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "{}"}}]}

    captured = {}

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, *exc_info):
            return False

        def get(self, url):
            return FakeGetResponse()

        def post(self, url, json):
            captured["model"] = json["model"]
            return FakePostResponse()

    import httpx

    monkeypatch.setattr(httpx, "Client", FakeClient)

    analyze_variety_image(b"fake", "image/jpeg")

    assert captured["model"] == "auto-detected-model"


# --- タスク2: 画像リサイズ ---------------------------------------------------


def test_resize_image_for_ai_shrinks_large_image():
    pytest.importorskip("PIL")
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (3000, 4000), color=(10, 20, 30)).save(buffer, format="JPEG")
    original_bytes = buffer.getvalue()

    resized_bytes, resized_media_type = _resize_image_for_ai(original_bytes, "image/jpeg")

    assert resized_media_type == "image/jpeg"
    assert len(resized_bytes) < len(original_bytes)

    with Image.open(io.BytesIO(resized_bytes)) as resized_img:
        assert max(resized_img.size) <= MAX_IMAGE_DIMENSION


def test_resize_image_for_ai_leaves_small_image_untouched():
    pytest.importorskip("PIL")
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (400, 300), color=(1, 2, 3)).save(buffer, format="PNG")
    original_bytes = buffer.getvalue()

    resized_bytes, resized_media_type = _resize_image_for_ai(original_bytes, "image/png")

    assert resized_bytes == original_bytes
    assert resized_media_type == "image/png"


def test_resize_image_for_ai_falls_back_on_undecodable_bytes():
    garbage = b"not an actual image"
    resized_bytes, resized_media_type = _resize_image_for_ai(garbage, "image/jpeg")

    assert resized_bytes == garbage
    assert resized_media_type == "image/jpeg"
