import { apiGet } from './client'
import type { CropFamily } from './types'

const BASE = '/api/crop-families'

// Phase2では科マスタの参照(色分け用の科名解決)のみ必要。マスタ編集UIはPhase3で実装する。
export const listCropFamilies = (): Promise<CropFamily[]> => apiGet<CropFamily[]>(BASE)
