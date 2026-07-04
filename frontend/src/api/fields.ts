import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { Field, FieldCreate, FieldUpdate } from './types'

const BASE = '/api/fields'

export const listFields = (): Promise<Field[]> => apiGet<Field[]>(BASE)
export const getField = (id: number): Promise<Field> => apiGet<Field>(`${BASE}/${id}`)
export const createField = (data: FieldCreate): Promise<Field> => apiPost<Field>(BASE, data)
export const updateField = (id: number, data: FieldUpdate): Promise<Field> =>
  apiPut<Field>(`${BASE}/${id}`, data)
export const deleteField = (id: number): Promise<void> => apiDelete(`${BASE}/${id}`)
