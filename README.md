# 農場作付け管理システム

小規模畑作農家（個人利用）向けの作付け計画管理システム。詳細仕様は [`docs/spec.md`](./docs/spec.md)、
実装計画は [`docs/implementation-plan.md`](./docs/implementation-plan.md) を参照。

現在の実装状況: **Phase 0（プロジェクト基盤構築）完了**（`/health` エンドポイントとフロントの疎通確認のみ）。

## ディレクトリ構成

```
agri-scheduler/
├── backend/    FastAPI + SQLAlchemy (Python 3.12, uv管理)
├── frontend/   React + TypeScript + Vite
├── data/
│   ├── images/ AI画像解析用アップロード画像の保存先
│   └── db/     SQLiteファイル (agri.db) の配置先
├── docs/       仕様書・実装計画
└── scripts/    開発用起動スクリプト
```

## セットアップ

### 前提

- Python 3.12 系 / [uv](https://docs.astral.sh/uv/)
- Node.js 20系以上 / npm

### 環境変数

```
cp .env.example .env
# .env を編集し、ANTHROPIC_API_KEY 等を設定（Phase 6以降で使用。Phase 0/1では未使用でよい）
```

### backend

```
cd backend
uv sync                # 依存パッケージのインストール（初回のみ）
uv run uvicorn app.main:app --reload --port 8000
```

- 起動確認: `curl http://localhost:8000/health` → `{"status":"ok"}`
- API: http://localhost:8000 （Swagger UI: http://localhost:8000/docs）

### frontend

```
cd frontend
npm install             # 依存パッケージのインストール（初回のみ）
npm run dev
```

- 開発サーバー: http://localhost:5173
- ビルド確認: `npm run build`

### 同時起動（任意）

```
./scripts/dev.sh
```

backend (port 8000) と frontend (port 5173) をまとめて起動する。`Ctrl+C` で両方停止する。

## データの永続化・バックアップ

- SQLiteファイルは `data/db/agri.db` に配置される（`.gitignore` 対象、リポジトリには含まれない）。
- バックアップは `data/db/agri.db` をコピーするだけでよい。
- アップロード画像は `data/images/` に保存される（同様に `.gitignore` 対象）。

## 今後の実装（Phase 1以降）

Phase 1以降でDBモデル・CRUD API・グラフィカルUI（圃場マップ、栽培カレンダー）・AI画像解析等を
順次実装する。詳細は [`docs/implementation-plan.md`](./docs/implementation-plan.md) を参照。
