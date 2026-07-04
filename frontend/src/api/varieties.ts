import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { Variety, VarietyCreate, VarietyUpdate } from './types'

const BASE = '/api/varieties'

export const listVarieties = (): Promise<Variety[]> => apiGet<Variety[]>(BASE)
export const getVariety = (id: number): Promise<Variety> => apiGet<Variety>(`${BASE}/${id}`)
export const createVariety = (data: VarietyCreate): Promise<Variety> =>
  apiPost<Variety>(BASE, data)
export const updateVariety = (id: number, data: VarietyUpdate): Promise<Variety> =>
  apiPut<Variety>(`${BASE}/${id}`, data)
export const deleteVariety = (id: number): Promise<void> => apiDelete(`${BASE}/${id}`)
