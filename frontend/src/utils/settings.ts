// ユーザー設定(気候帯)の永続化。
// バックエンドにユーザー設定テーブルは無く、個人利用アプリのため追加もしない。
// ブラウザのlocalStorageに保存するだけの簡易実装とする(spec.md 4.2「ユーザーの地域」)。

import type { ClimateZone } from '../api/types'

const CLIMATE_ZONE_KEY = 'agri-scheduler:climateZone'

export const CLIMATE_ZONE_LABELS: Record<ClimateZone, string> = {
  cold: '寒地',
  temperate: '温暖地',
  warm: '暖地',
}

function isClimateZone(value: string | null): value is ClimateZone {
  return value === 'cold' || value === 'temperate' || value === 'warm'
}

// 未設定時は"temperate"(温暖地)を既定値とする。
export function getClimateZone(): ClimateZone {
  try {
    const stored = window.localStorage.getItem(CLIMATE_ZONE_KEY)
    return isClimateZone(stored) ? stored : 'temperate'
  } catch {
    // localStorageが使えない環境(プライベートモード等)では既定値にフォールバック
    return 'temperate'
  }
}

export function setClimateZone(zone: ClimateZone): void {
  try {
    window.localStorage.setItem(CLIMATE_ZONE_KEY, zone)
  } catch {
    // 保存できなくても致命的ではないため無視する
  }
}
