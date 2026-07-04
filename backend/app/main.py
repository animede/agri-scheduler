"""農場作付け管理システム backend エントリポイント。

Phase 0 時点では疎通確認用の `/health` エンドポイントのみを提供する。
CRUDロジック・DBモデルはPhase 1以降で追加する。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="農場作付け管理システム API")

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
