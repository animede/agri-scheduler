"""農場作付け管理システム backend エントリポイント。

Phase 1: コアデータモデル(Field/Bed/BedSegment/CropFamily/Crop/Variety/
Planting/Task)とCRUD APIを提供する。マイグレーションツールは導入せず、
起動時に `Base.metadata.create_all` でテーブルを作成するシンプルな方式。
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import all_routers
from app.db import Base, SessionLocal, engine
from app.seed import seed_crop_families

# app.models を読み込むことで全モデルクラスをBase.metadataに登録する
import app.models  # noqa: E402,F401


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_crop_families(db)
    finally:
        db.close()
    yield


app = FastAPI(title="農場作付け管理システム API", lifespan=lifespan)

# フロントエンド(Vite dev server)からのアクセスを許可
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for _router in all_routers:
    app.include_router(_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
