// 「今週の推奨作業」サマリ(spec.md 4.8 / implementation-plan.md フェーズ7)の抽出ロジック。
// 対象圃場に属する全区画のPlantingに紐づくTaskのうち、is_completed=falseかつ
// planned_date_startが「今日から7日後まで」または既に期限超過(今日より前)のものを一覧化する。

import type { Bed, BedSegment, Planting, Task } from '../api/types'
import type { Lookups } from './resolve'
import { resolveVariety } from './resolve'

export interface WeeklyTaskItem {
  task: Task
  planting: Planting
  segment: BedSegment
  bedName: string
  varietyName: string
  overdue: boolean
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// referenceDateは通常は「今日」だが、テスト容易性のため引数として渡せるようにしておく。
export function buildWeeklyTasks(
  tasks: Task[],
  plantingById: Map<number, Planting>,
  segmentById: Map<number, BedSegment>,
  bedById: Map<number, Bed>,
  lookups: Lookups,
  referenceDate: Date = new Date(),
): WeeklyTaskItem[] {
  const todayStr = toDateStr(referenceDate)
  const in7 = new Date(referenceDate)
  in7.setDate(in7.getDate() + 7)
  const in7Str = toDateStr(in7)

  const items: WeeklyTaskItem[] = []
  for (const task of tasks) {
    if (task.is_completed) continue
    if (!task.planned_date_start) continue
    const overdue = task.planned_date_start < todayStr
    const upcoming = task.planned_date_start >= todayStr && task.planned_date_start <= in7Str
    if (!overdue && !upcoming) continue

    const planting = plantingById.get(task.planting_id)
    if (!planting) continue
    const segment = segmentById.get(planting.bed_segment_id)
    if (!segment) continue
    const bed = bedById.get(segment.bed_id)
    const { variety } = resolveVariety(planting.variety_id, lookups)

    items.push({
      task,
      planting,
      segment,
      bedName: bed?.name ?? `畝#${segment.bed_id}`,
      varietyName: variety?.name ?? `品種#${planting.variety_id}`,
      overdue,
    })
  }

  // 期限超過を先頭に、その中/その後はそれぞれ予定日の昇順で並べる。
  return items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    return (a.task.planned_date_start ?? '').localeCompare(b.task.planned_date_start ?? '')
  })
}
