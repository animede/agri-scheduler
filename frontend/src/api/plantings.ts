import { apiGet } from './client'
import type { Planting } from './types'

const BASE = '/api/plantings'

// バックエンドは作付けを全件フラットに返すため、bed_segment_idでのフィルタはクライアント側で行う。
// Phase2では作付けの新規作成・編集UIは範囲外(Phase4)のため参照のみ実装する。
export const listPlantings = (): Promise<Planting[]> => apiGet<Planting[]>(BASE)
