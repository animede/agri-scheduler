// 連作障害チェックロジック(spec.md 4.5)。
//
// 判定式: 対象区画の他のPlanting(=比較対象)のうち、対象品種のCropFamilyと同じCropFamilyのものがあり、
// かつ |対象year - 比較対象year| < CropFamily.rotation_interval_years であれば警告とする。
// 仕様上は「強制ブロックせず警告のみ」とされているため、ここでは判定結果を返すのみで
// 呼び出し側(フォーム側)は保存をブロックしない。

import type { Planting } from '../api/types'
import { resolveVariety } from './resolve'
import type { Lookups } from './resolve'

export interface RotationConflict {
  warning: true
  message: string
  conflictingPlanting: Planting
  cropFamilyName: string
  rotationIntervalYears: number
  yearsDiff: number
}

export interface RotationOk {
  warning: false
}

export type RotationCheckResult = RotationConflict | RotationOk

// 「X年前」「X年後」「同じ年」の表現を作る。targetYearから見てotherYearが何年前/後かを表す。
function describeYearGap(targetYear: number, otherYear: number): string {
  const diff = targetYear - otherYear
  if (diff > 0) return `${diff}年前`
  if (diff < 0) return `${-diff}年後`
  return '同じ年'
}

// 区画内の他のPlantingと比較し、輪作障害の警告が必要か判定する。
// - varietyId/year: これから登録・編集しようとしている作付けの内容
// - otherPlantings: 比較対象の一覧(同一区画の他のPlanting)。編集中の対象自身は
//   呼び出し側であらかじめ除外しておくこと(自分自身との比較は常に無意味なため)。
// - 複数の抵触候補がある場合は、年差が最も小さい(最も深刻な)ものを警告として採用する。
export function checkRotation(
  varietyId: number,
  year: number,
  otherPlantings: Planting[],
  lookups: Lookups,
): RotationCheckResult {
  const { cropFamily } = resolveVariety(varietyId, lookups)
  if (!cropFamily) return { warning: false }

  let worst: { planting: Planting; diff: number } | null = null

  for (const p of otherPlantings) {
    const { cropFamily: otherFamily } = resolveVariety(p.variety_id, lookups)
    if (!otherFamily || otherFamily.id !== cropFamily.id) continue

    const diff = Math.abs(year - p.year)
    if (diff < cropFamily.rotation_interval_years) {
      if (!worst || diff < worst.diff) {
        worst = { planting: p, diff }
      }
    }
  }

  if (!worst) return { warning: false }

  const { crop: conflictingCrop } = resolveVariety(worst.planting.variety_id, lookups)
  const cropLabel = conflictingCrop ? `（${conflictingCrop.name}）` : ''
  const yearGapLabel = describeYearGap(year, worst.planting.year)

  const message =
    `この区画では${yearGapLabel}（${worst.planting.year}年）に${cropFamily.name}${cropLabel}を栽培しています。` +
    `${cropFamily.name}は${cropFamily.rotation_interval_years}年空けることが推奨されています。`

  return {
    warning: true,
    message,
    conflictingPlanting: worst.planting,
    cropFamilyName: cropFamily.name,
    rotationIntervalYears: cropFamily.rotation_interval_years,
    yearsDiff: worst.diff,
  }
}

// 区画の「現在の作付け」について、それより前(year昇順で過去)の作付け履歴との
// 連作障害リスクを判定する(圃場マップ上のアイコン表示・区画詳細パネルの警告表示用)。
export function checkCurrentRotationRisk(
  plantings: Planting[],
  current: Planting,
  lookups: Lookups,
): RotationCheckResult {
  const earlier = plantings.filter((p) => p.id !== current.id && p.year < current.year)
  return checkRotation(current.variety_id, current.year, earlier, lookups)
}
