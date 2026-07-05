// 年間計画のロール(次年度展開)ロジック(spec.md 4.7, implementation-plan.md フェーズ8)。
//
// 「selectedYearにPlantingがある区画」を対象に、輪作年限を踏まえた翌年の品種候補を
// 品種マスタ全体から絞り込む。判定自体はutils/rotation.tsのcheckRotationをそのまま使い、
// 「区画の既存履歴(今年のPlantingを含む)に対して、翌年その品種を植えても警告が出ないか」を
// 品種ごとに評価する。安全な候補が複数あれば全て提示し、直近(今年)の科と異なる科を
// 優先する(多様性優先の簡易ロジック)。安全な候補が1つも無い場合はhasSafeCandidate=falseとし、
// 呼び出し側で「候補なし(要検討)」の警告表示に用いる。

import type { BedSegment, Planting, Variety } from '../api/types'
import { checkRotation } from './rotation'
import type { RotationCheckResult } from './rotation'
import { resolveVariety } from './resolve'
import type { Lookups } from './resolve'

export interface RolloverCandidate {
  variety: Variety
  cropFamilyName: string | null
  rotationCheck: RotationCheckResult
}

export interface RolloverRow {
  segment: BedSegment
  // 今年(selectedYear)の代表Planting(複数ある場合はid最大のものを採用)
  currentPlanting: Planting
  currentCropFamilyName: string | null
  // 全品種を「安全→科が異なる」を優先する順で並べた候補一覧(⚠付きの危険な候補も含む)
  candidates: RolloverCandidate[]
  // 一押し候補(candidates[0])のvariety_id。候補が1件も無い場合はnull
  defaultVarietyId: number | null
  // 安全な候補(警告なし)が1件以上あるか
  hasSafeCandidate: boolean
  // 既に翌年(selectedYear+1)に登録済みのPlanting(二重登録防止の判定に使う)
  existingNextYearPlantings: Planting[]
}

// 区画1件分のロール候補行を算出する。selectedYearのPlantingが無い区画はロール対象外のためnull。
export function buildRolloverRow(
  segment: BedSegment,
  segmentPlantings: Planting[],
  varieties: Variety[],
  lookups: Lookups,
  year: number,
): RolloverRow | null {
  const thisYearPlantings = segmentPlantings.filter((p) => p.year === year)
  if (thisYearPlantings.length === 0) return null

  // 同一年に複数件ある場合はid最大(=最後に登録されたもの)を代表とする(pickCurrentPlantingと同様の考え方)
  const currentPlanting = thisYearPlantings.reduce(
    (latest, p) => (p.id > latest.id ? p : latest),
    thisYearPlantings[0],
  )
  const { cropFamily: currentFamily } = resolveVariety(currentPlanting.variety_id, lookups)

  const nextYear = year + 1
  const existingNextYearPlantings = segmentPlantings.filter((p) => p.year === nextYear)

  const candidates: RolloverCandidate[] = varieties.map((variety) => {
    const rotationCheck = checkRotation(variety.id, nextYear, segmentPlantings, lookups)
    const { cropFamily } = resolveVariety(variety.id, lookups)
    return { variety, cropFamilyName: cropFamily?.name ?? null, rotationCheck }
  })

  // 順位付け: 0=安全かつ今年と異なる科(最優先) / 1=安全だが今年と同じ科 / 2=輪作警告あり
  const rank = (c: RolloverCandidate): number => {
    if (c.rotationCheck.warning) return 2
    if (currentFamily && c.cropFamilyName === currentFamily.name) return 1
    return 0
  }
  candidates.sort((a, b) => {
    const diff = rank(a) - rank(b)
    if (diff !== 0) return diff
    return a.variety.name.localeCompare(b.variety.name, 'ja')
  })

  const hasSafeCandidate = candidates.some((c) => !c.rotationCheck.warning)
  const defaultVarietyId = candidates[0]?.variety.id ?? null

  return {
    segment,
    currentPlanting,
    currentCropFamilyName: currentFamily?.name ?? null,
    candidates,
    defaultVarietyId,
    hasSafeCandidate,
    existingNextYearPlantings,
  }
}

// 圃場内の対象区画すべてについてロール候補行を組み立てる。対象外の区画(今年の作付けが無い)は含まれない。
export function buildRolloverPlan(
  segments: BedSegment[],
  plantingsBySegment: Map<number, Planting[]>,
  varieties: Variety[],
  lookups: Lookups,
  year: number,
): RolloverRow[] {
  const rows: RolloverRow[] = []
  for (const segment of segments) {
    const row = buildRolloverRow(segment, plantingsBySegment.get(segment.id) ?? [], varieties, lookups, year)
    if (row) rows.push(row)
  }
  return rows
}
