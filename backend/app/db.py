"""SQLAlchemy engine / session の雛形。

Phase 1 でモデル（Field, Bed, BedSegment, CropFamily, Crop, Variety,
Planting, Task）を追加する前提の骨組みのみを用意する。

DB接続先はプロジェクトルート直下の `data/db/agri.db`（SQLite）。
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

# backend/app/db.py から見て ../../data/db/agri.db がプロジェクトルートの data/db/agri.db
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "db" / "agri.db"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# SQLite利用時、DBファイルの親ディレクトリが存在しない場合は作成しておく
if DATABASE_URL.startswith("sqlite:///"):
    db_file = Path(DATABASE_URL.replace("sqlite:///", "", 1))
    db_file.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """モデル共通のベースクラス。Phase 1 以降で各モデルがこれを継承する。"""

    pass


def get_db():
    """FastAPIの依存性注入で使うDBセッションジェネレータ（Phase 1で使用予定）。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
