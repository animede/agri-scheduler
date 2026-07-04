import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { Bed, BedCreate, BedUpdate } from './types'

const BASE = '/api/beds'

// バックエンドは畝を全件フラットに返すため、field_idでのフィルタはクライアント側で行う。
export const listBeds = (): Promise<Bed[]> => apiGet<Bed[]>(BASE)
export const getBed = (id: number): Promise<Bed> => apiGet<Bed>(`${BASE}/${id}`)
export const createBed = (data: BedCreate): Promise<Bed> => apiPost<Bed>(BASE, data)
export const updateBed = (id: number, data: BedUpdate): Promise<Bed> =>
  apiPut<Bed>(`${BASE}/${id}`, data)
export const deleteBed = (id: number): Promise<void> => apiDelete(`${BASE}/${id}`)
