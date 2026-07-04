"""pytest共通fixture。

本番DB(`data/db/agri.db`)を汚染しないよう、テスト実行時はテスト専用の
一時SQLiteファイルを使用する。`DATABASE_URL` は `app.db` モジュールの
import時点で読み込まれるため、他のapp.*モジュールをimportするより前に
ここで環境変数を設定しておく必要がある。
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_tmp_dir = tempfile.TemporaryDirectory()
_tmp_db_path = Path(_tmp_dir.name) / "test_agri.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db_path}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """アプリのlifespan(テーブル作成+CropFamily初期投入)を通した状態のTestClient。"""

    with TestClient(app) as test_client:
        yield test_client
