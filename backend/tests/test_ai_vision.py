"""`app.services.ai_vision.parse_extracted_json` の単体テスト。

Anthropicからの生テキスト応答は
  - 素のJSONのみ
  - ```json ... ``` のコードフェンスに包まれている
  - 前後に説明文が混ざっている
  - JSONとして解釈不能
のいずれのパターンもあり得るため、それぞれ検証する。
"""

from __future__ import annotations

import pytest

from app.services.ai_vision import parse_extracted_json


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
