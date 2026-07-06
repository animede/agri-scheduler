# backend (FastAPI, port 8000) と frontend (Vite, port 5173) を同時起動する。
# Ctrl+C で両方のプロセスを終了する。
#
# 使い方 (PowerShell):
#   ./scripts/dev.ps1
#
# 実行ポリシーでブロックされる場合は、以下のいずれかで実行する:
#   powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
#   または (現在のユーザーで許可): Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = 'Stop'

# scripts/dev.ps1 から見て親ディレクトリがプロジェクトルート
$RootDir = Split-Path -Parent $PSScriptRoot

$backend = $null
$frontend = $null

function Stop-DevServers {
    Write-Host ''
    Write-Host 'Stopping dev servers...'
    foreach ($proc in @($script:backend, $script:frontend)) {
        if ($proc -and -not $proc.HasExited) {
            try {
                # 子プロセスごと確実に停止する
                taskkill /PID $proc.Id /T /F *> $null
            } catch {
                try { $proc.Kill() } catch { }
            }
        }
    }
}

try {
    Write-Host 'Starting backend (http://localhost:8000) ...'
    $backend = Start-Process -FilePath 'uv' `
        -ArgumentList 'run', 'uvicorn', 'app.main:app', '--reload', '--port', '8000' `
        -WorkingDirectory (Join-Path $RootDir 'backend') `
        -NoNewWindow -PassThru

    Write-Host 'Starting frontend (http://localhost:5173) ...'
    $frontend = Start-Process -FilePath 'npm' `
        -ArgumentList 'run', 'dev', '--', '--port', '5173' `
        -WorkingDirectory (Join-Path $RootDir 'frontend') `
        -NoNewWindow -PassThru

    Write-Host ''
    Write-Host 'Dev servers running. Press Ctrl+C to stop both.'

    # どちらかのプロセスが終了するまで待機する
    while ($true) {
        if ($backend.HasExited -or $frontend.HasExited) { break }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Stop-DevServers
}
