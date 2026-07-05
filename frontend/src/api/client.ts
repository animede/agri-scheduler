// バックエンドAPI共通fetchラッパー。
// ベースURLは環境変数 VITE_API_BASE_URL があればそれを使い、無ければローカル開発用の
// http://localhost:8000 にフォールバックする。

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (body && typeof body.detail === 'string') return body.detail
    if (body && body.detail !== undefined) return JSON.stringify(body.detail)
  } catch {
    // レスポンスボディがJSONでない場合は無視してステータス文だけ使う
  }
  return `HTTP ${res.status} ${res.statusText}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError(0, `バックエンド(${API_BASE_URL})に接続できませんでした`)
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res))
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' })
}

// multipart/form-data送信用(Phase6: AI画像解析の画像アップロードで使用)。
// headers を空オブジェクトで上書きし、`Content-Type: application/json` を
// 付与しないようにする(ブラウザがboundary付きのmultipart/form-dataヘッダーを
// 自動設定する)。
export function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: formData, headers: {} })
}

// data/images配下の相対パス(例: "images/xxxx.jpg")から静的配信URLを組み立てる。
export function buildStaticUrl(relativePath: string): string {
  return `${API_BASE_URL}/static/${relativePath}`
}
