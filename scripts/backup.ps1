# データバックアップスクリプト (Windows / PowerShell 版)。
# data/db/agri.db (SQLiteファイル) と data/images/ (AI画像解析用にアップロードした
# 種苗パッケージ画像) を、タイムスタンプ付きディレクトリ backups/YYYY-MM-DD_HHMM/ に
# コピーする。バックアップ自体はリポジトリに含めない(.gitignoreでbackups/を除外済み)。
#
# 使い方 (PowerShell):
#   ./scripts/backup.ps1
#
# 実行ポリシーでブロックされる場合は、以下のいずれかで実行する:
#   powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1
#
# 復元する場合は、該当のタイムスタンプディレクトリの中身を data/db/agri.db,
# data/images/ にコピーし直せばよい(アプリは停止した状態で行うこと)。

$ErrorActionPreference = 'Stop'

# scripts/backup.ps1 から見て親ディレクトリがプロジェクトルート
$RootDir = Split-Path -Parent $PSScriptRoot

$Timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$DestDir = Join-Path $RootDir "backups/$Timestamp"

$DbFile = Join-Path $RootDir 'data/db/agri.db'
$ImagesDir = Join-Path $RootDir 'data/images'

$DestDbDir = Join-Path $DestDir 'db'
$DestImagesDir = Join-Path $DestDir 'images'

New-Item -ItemType Directory -Force -Path $DestDbDir | Out-Null
New-Item -ItemType Directory -Force -Path $DestImagesDir | Out-Null

if (Test-Path -Path $DbFile -PathType Leaf) {
    $DestDb = Join-Path $DestDbDir 'agri.db'
    Copy-Item -Path $DbFile -Destination $DestDb
    Write-Host "Backed up: $DbFile -> $DestDb"
} else {
    Write-Host "Warning: $DbFile が見つかりません(まだ何もデータを登録していない可能性があります)。"
}

if ((Test-Path -Path $ImagesDir -PathType Container) -and (Get-ChildItem -Path $ImagesDir -Force | Select-Object -First 1)) {
    Copy-Item -Path (Join-Path $ImagesDir '*') -Destination $DestImagesDir -Recurse -Force
    Write-Host "Backed up: $ImagesDir -> $DestImagesDir"
} else {
    Write-Host "Info: $ImagesDir は空です(アップロード画像なし)。"
}

Write-Host "Backup complete: $DestDir"
