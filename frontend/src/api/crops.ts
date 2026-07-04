import { apiGet } from './client'
import type { Crop } from './types'

const BASE = '/api/crops'

// Phase2では作物マスタの参照(科の解決)のみ必要。登録・編集フォームはPhase3で実装する。
export const listCrops = (): Promise<Crop[]> => apiGet<Crop[]>(BASE)
