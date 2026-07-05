"""AI抽出結果の数値フィールドに対する、緩やかな型合わせ(Phase6拡張)。

Anthropic Claudeは概ねプロンプト指示どおり数値のみを返すが、ローカルLLM
(llama.cpp等のOpenAI互換サーバー)は `days_to_harvest` のようなint期待の
フィールドに対して「開花後45〜50日」のような自然文で返すことがある
(実際に確認済み)。

本モジュールはそのような文字列値を許容し、
  - 正規表現で最初の数値が抽出できればその数値(int/float)に変換する
  - 抽出できなければ null にする
  - 元のテキストが持っていた情報は失わず、`protection_notes` の末尾に
    追記して保持する
という緩和処理を行う。
"""

from __future__ import annotations

import re

# int/float を期待するフィールド名一覧。
NUMERIC_FIELDS = [
    "seedling_days",
    "days_to_harvest",
    "plant_spacing_cm",
    "row_spacing_cm",
]

# protection_notesへ追記する際の日本語ラベル。
_FIELD_LABELS = {
    "seedling_days": "育苗日数の目安",
    "days_to_harvest": "収穫までの目安",
    "plant_spacing_cm": "株間の目安",
    "row_spacing_cm": "条間の目安",
}

_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")


def normalize_numeric_fields(data: dict) -> dict:
    """`data` 内の数値期待フィールドを検査し、非数値文字列を柔軟に変換する。

    `data` を直接変更したうえで返す(呼び出しやすさのため)。
    """

    notes_additions: list[str] = []

    for field in NUMERIC_FIELDS:
        value = data.get(field)

        if value is None or isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            continue
        if not isinstance(value, str):
            # 想定外の型(list/dict等)はnullにフォールバックする
            data[field] = None
            continue

        text = value.strip()
        if not text:
            data[field] = None
            continue

        match = _NUMBER_RE.search(text)
        if match:
            num_str = match.group(0)
            data[field] = float(num_str) if "." in num_str else int(num_str)
        else:
            data[field] = None

        label = _FIELD_LABELS.get(field, field)
        notes_additions.append(f"{label}: {text}")

    if notes_additions:
        appendix = "\n".join(notes_additions)
        existing = data.get("protection_notes")
        if isinstance(existing, str) and existing.strip():
            data["protection_notes"] = f"{existing.strip()}\n{appendix}"
        else:
            data["protection_notes"] = appendix

    return data
