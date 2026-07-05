import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { Planting, PlantingCreate, PlantingUpdate } from './types'

const BASE = '/api/plantings'

// バックエンドは作付けを全件フラットに返すため、bed_segment_idでのフィルタはクライアント側で行う。
export const listPlantings = (): Promise<Planting[]> => apiGet<Planting[]>(BASE)
export const getPlanting = (id: number): Promise<Planting> => apiGet<Planting>(`${BASE}/${id}`)
export const createPlanting = (data: PlantingCreate): Promise<Planting> =>
  apiPost<Planting>(BASE, data)
export const updatePlanting = (id: number, data: PlantingUpdate): Promise<Planting> =>
  apiPut<Planting>(`${BASE}/${id}`, data)
export const deletePlanting = (id: number): Promise<void> => apiDelete(`${BASE}/${id}`)
