#!/usr/bin/env bash
# データバックアップスクリプト。
# data/db/agri.db (SQLiteファイル) と data/images/ (AI画像解析用にアップロードした
# 種苗パッケージ画像) を、タイムスタンプ付きディレクトリ backups/YYYY-MM-DD_HHMM/ に
# コピーする。バックアップ自体はリポジトリに含めない(.gitignoreでbackups/を除外済み)。
#
# 使い方:
#   ./scripts/backup.sh
#
# 復元する場合は、該当のタイムスタンプディレクトリの中身を data/db/agri.db,
# data/images/ にコピーし直せばよい(アプリは停止した状態で行うこと)。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TIMESTAMP="$(date +%Y-%m-%d_%H%M)"
DEST_DIR="$ROOT_DIR/backups/$TIMESTAMP"

DB_FILE="$ROOT_DIR/data/db/agri.db"
IMAGES_DIR="$ROOT_DIR/data/images"

mkdir -p "$DEST_DIR/db" "$DEST_DIR/images"

if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$DEST_DIR/db/agri.db"
  echo "Backed up: $DB_FILE -> $DEST_DIR/db/agri.db"
else
  echo "Warning: $DB_FILE が見つかりません(まだ何もデータを登録していない可能性があります)。"
fi

if [ -d "$IMAGES_DIR" ] && [ -n "$(ls -A "$IMAGES_DIR" 2>/dev/null)" ]; then
  cp -r "$IMAGES_DIR/." "$DEST_DIR/images/"
  echo "Backed up: $IMAGES_DIR -> $DEST_DIR/images/"
else
  echo "Info: $IMAGES_DIR は空です(アップロード画像なし)。"
fi

echo "Backup complete: $DEST_DIR"
