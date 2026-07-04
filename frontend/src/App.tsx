import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = 'http://localhost:8000'

type ConnectionStatus = 'checking' | 'ok' | 'error'

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setStatus(data?.status === 'ok' ? 'ok' : 'error')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="app">
      <h1>農場作付け管理システム</h1>
      {status === 'checking' && <p>バックエンドに接続確認中...</p>}
      {status === 'ok' && <p className="status-ok">バックエンド接続OK</p>}
      {status === 'error' && (
        <p className="status-error">
          バックエンドに接続できませんでした（{API_BASE_URL} を確認してください）
        </p>
      )}
    </main>
  )
}

export default App
