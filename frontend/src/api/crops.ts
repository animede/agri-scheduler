import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { Crop, CropCreate, CropUpdate } from './types'

const BASE = '/api/crops'

export const listCrops = (): Promise<Crop[]> => apiGet<Crop[]>(BASE)
export const getCrop = (id: number): Promise<Crop> => apiGet<Crop>(`${BASE}/${id}`)
export const createCrop = (data: CropCreate): Promise<Crop> => apiPost<Crop>(BASE, data)
export const updateCrop = (id: number, data: CropUpdate): Promise<Crop> =>
  apiPut<Crop>(`${BASE}/${id}`, data)
export const deleteCrop = (id: number): Promise<void> => apiDelete(`${BASE}/${id}`)
