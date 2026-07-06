# 農場作付け管理システム

小規模畑作農家（個人利用）向けの作付け計画管理システム。畑の物理レイアウト（圃場マップ）と
栽培工程（栽培カレンダー）を視覚的に把握しながら、多品種の作付け計画・作業タスク・連作障害
チェックを一元管理できる。詳細仕様は [`docs/spec.md`](./docs/spec.md)、実装計画は
[`docs/implementation-plan.md`](./docs/implementation-plan.md) を参照。

## できること

- **圃場・畝・区画管理**: 圃場（畑）を複数登録し、圃場内に畝を配置、畝を区画に分割して管理できる。
  区画には現在の作付け状況が品種の科（CropFamily）ごとの色分けで表示される。
- **品種マスタ管理**: 品種ごとに栽培暦（種蒔き・植え付け・収穫時期、地域帯別）、株間・条間、
  マルチング要否、保温対策メモなどを登録できる。
- **AI画像解析（任意機能）**: 種苗会社の種袋画像をアップロードすると、Claude Vision API
  またはローカルのOpenAI互換マルチモーダルLLM（llama.cpp server等）が栽培暦を自動抽出し、
  品種登録フォームに反映する（要 `ANTHROPIC_API_KEY` または `AI_VISION_BASE_URL`。
  未設定でも他の機能はすべて通常どおり使用できる）。
- **作付け登録＆連作障害チェック**: 区画×品種×年で作付けを登録すると、その区画の過去の作付け
  履歴（科）を参照し、輪作年限に抵触する場合は警告を表示する（強制ブロックはしない）。
- **作業タスクの自動生成**: 作付け登録時に、品種の栽培暦から土作り・畝立て・種蒔き・育苗・
  マルチング・植え付け・中間管理・収穫・片付けの作業タスクを自動生成し、完了チェックや実績日
  記録ができる。
- **栽培カレンダービュー**: 1年間をシーズンホイール（円環）で表示し、区画ごとの作付け状況を
  種蒔き〜収穫のステージバーとして俯瞰できる（ガントチャート形式は採用していない）。
- **年間計画のロール（次年度展開）**: 「次年度にロール」操作で、当年の作付け構成をベースに
  輪作ルールを踏まえた翌年計画のたたき台を作成できる。

## ディレクトリ構成

```
agri-scheduler/
├── backend/    FastAPI + SQLAlchemy (Python 3.12, uv管理)
├── frontend/   React + TypeScript + Vite
├── data/
│   ├── images/ AI画像解析用アップロード画像の保存先
│   └── db/     SQLiteファイル (agri.db) の配置先
├── docs/       仕様書・実装計画
├── scripts/    起動・バックアップ用スクリプト
└── backups/    バックアップ出力先(scripts/backup.shが作成。リポジトリには含めない)
```

## セットアップ

### 前提

- Python 3.12 系 / [uv](https://docs.astral.sh/uv/)
- Node.js 20系以上 / npm

Linux / macOS / Windows のいずれでも動作する。Windowsの場合は下記の
「起動方法」「バックアップ方法」で PowerShell 版スクリプト(`.ps1`)を使う。

### backend

```
cd backend
uv sync    # 依存パッケージのインストール(初回のみ)
```

### frontend

```
cd frontend
npm install    # 依存パッケージのインストール(初回のみ)
```

## 起動方法

### まとめて起動(推奨)

Linux / macOS:

```
./scripts/dev.sh
```

Windows (PowerShell):

```
./scripts/dev.ps1
```

backend (http://localhost:8000) と frontend (http://localhost:5173) をまとめて起動する。
`Ctrl+C` で両方停止する。

> Windowsで「このシステムではスクリプトの実行が無効になっている」等のエラーが出る場合は、
> `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1` で実行するか、
> 一度だけ `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` を実行して許可する。
> (Git Bash や WSL を使う場合は `.sh` 版をそのまま実行できる。)

### 個別に起動する場合

OS共通(Windowsも同じコマンドでよい。ターミナルを2つ開く):

```
# backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# frontend (別ターミナルで)
cd frontend
npm run dev
```

起動したら、ブラウザで **http://localhost:5173** にアクセスする。

- backend起動確認: `curl http://localhost:8000/health` → `{"status":"ok"}`
- API仕様(Swagger UI): http://localhost:8000/docs

## AI画像解析機能を使う場合の設定(任意)

種苗パッケージ画像から栽培暦を自動抽出するAI画像解析機能を使う場合のみ、以下の設定が必要。
**設定しなくても、圃場マップ・品種の手動登録・作付け・タスク管理・栽培カレンダー・年間ロール
など、AI画像解析以外のすべての機能は通常どおり使用できる。**

```
cp .env.example .env
```

AI画像解析には2通りの方法があり、どちらか一方を設定すればよい(両方設定した場合は
`ANTHROPIC_API_KEY` が優先される)。

### 方法1: Anthropic Claude Vision API(クラウド)を使う

`.env` を編集し、[Anthropic Console](https://console.anthropic.com/) で発行したAPIキーを設定する。

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```

### 方法2: ローカル/自前サーバーのOpenAI互換API(マルチモーダルLLM)を使う

`ANTHROPIC_API_KEY` を持っていない場合でも、llama.cpp server等、OpenAI互換の
`/v1/chat/completions` エンドポイントを持つマルチモーダル(画像入力対応)LLMサーバーを
ローカルまたは手元のネットワークで起動していれば、そちらを使うことができる。

```
AI_VISION_BASE_URL=http://127.0.0.1:64650/v1
AI_VISION_MODEL=unsloth/gemma-4-31B-it-GGUF:Q4_K_XL
```

- `AI_VISION_MODEL` を省略した場合は `{AI_VISION_BASE_URL}/models` を呼び出して
  先頭のモデルIDを自動取得しようとする(取得できない場合はエラーになるため、
  基本的には明示的に指定することを推奨)。
- ローカルLLMは`days_to_harvest`等の数値項目を「開花後45〜50日」のような自然文で
  返すことがあるが、その場合は数値を抽出しつつ元のテキストを備考欄
  (`protection_notes`)へ自動的に退避するため、情報は失われない。
- アップロード画像は呼び出し前に長辺1600px程度へ自動リサイズしてから送信する
  (応答速度・トークン節約のため。保存される画像ファイル自体はリサイズしない)。

いずれの方法でも、未設定・またはネットワーク未接続の場合、品種登録フォームの「AIで解析」は
エラーメッセージを表示し、手動入力へのフォールバックを促す(アプリがクラッシュすることはない)。

## データの保存場所・バックアップ

- SQLiteファイル: `data/db/agri.db`(圃場・畝・区画・品種・作付け・タスク等すべてのデータ)
- アップロード画像: `data/images/`(AI画像解析用にアップロードした種苗パッケージ画像)

いずれも `.gitignore` 対象で、リポジトリには含まれない。ローカルファイルベースのため、
このシステム全体はネットワークに接続していなくても(AI画像解析以外は)動作する。

### バックアップ方法

Linux / macOS:

```
./scripts/backup.sh
```

Windows (PowerShell):

```
./scripts/backup.ps1
```

`data/db/agri.db` と `data/images/` を、実行時刻のタイムスタンプ付きディレクトリ
`backups/YYYY-MM-DD_HHMM/` にまとめてコピーする(`backups/` はリポジトリに含めない)。
定期的に(例: 週1回)実行しておくとよい。

復元する場合は、アプリを停止した状態で `backups/<日時>/db/agri.db` を
`data/db/agri.db` に、`backups/<日時>/images/` の中身を `data/images/` にコピーし直す。

## 主要画面

| 画面 | パス | 内容 |
|---|---|---|
| 圃場一覧 | `/` | 圃場の新規作成・一覧・削除 |
| 圃場マップ / 栽培カレンダー | `/fields/:fieldId` | 畝・区画の配置編集、作付け登録、作業タスク管理、輪作警告表示、シーズンホイールでの年間俯瞰、次年度ロール |
| 品種管理 | `/varieties` | 品種の新規登録・編集・検索、栽培暦入力、AI画像解析(任意) |
| 設定 | `/settings` | 気候帯(寒地/温暖地/暖地)の設定。ブラウザのlocalStorageにのみ保存され、栽培暦の時期表示・作業タスクの時期推測に反映される |

## 開発者向け: テスト・ビルド確認

```
cd backend && uv run pytest        # backendテスト
cd frontend && npm run build       # frontend型チェック+ビルド
cd frontend && npm run lint        # frontend Lint (oxlint)
```
