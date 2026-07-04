import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { BedSegment, BedSegmentCreate, BedSegmentUpdate } from './types'

const BASE = '/api/bed-segments'

// バックエンドは区画を全件フラットに返すため、bed_idでのフィルタはクライアント側で行う。
export const listBedSegments = (): Promise<BedSegment[]> => apiGet<BedSegment[]>(BASE)
export const getBedSegment = (id: number): Promise<BedSegment> => apiGet<BedSegment>(`${BASE}/${id}`)
export const createBedSegment = (data: BedSegmentCreate): Promise<BedSegment> =>
  apiPost<BedSegment>(BASE, data)
export const updateBedSegment = (id: number, data: BedSegmentUpdate): Promise<BedSegment> =>
  apiPut<BedSegment>(`${BASE}/${id}`, data)
export const deleteBedSegment = (id: number): Promise<void> => apiDelete(`${BASE}/${id}`)
