import { apiGet } from './client'
import type { Variety } from './types'

const BASE = '/api/varieties'

// Phase2では品種マスタの参照(品種名解決)のみ必要。登録・編集フォームはPhase3で実装する。
export const listVarieties = (): Promise<Variety[]> => apiGet<Variety[]>(BASE)
