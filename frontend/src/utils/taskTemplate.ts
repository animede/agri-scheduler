// 作付け登録時の作業タスク自動生成ロジック(spec.md 4.4/4.8, implementation-plan.md フェーズ5)。
//
// 基準日は「実績優先 → 計画 → 栽培暦からの推測」の順で解決する。栽培暦からの推測はあくまで
// 近似値であるため、parsePeriodTextで得られる範囲の中央日を代表日として採用する
// (範囲の開始日ではなく中央日を採るのは、「推奨時期の真ん中あたりに実施するのが典型的」という
// 想定によるもの。単純化のための判断であり、厳密な農学的根拠があるわけではない)。

import type { ClimateZone, Planting, RegionCalendar, Variety } from '../api/types'
import { parsePeriodText } from './calendarParse'
import type { ParsedPeriod } from './calendarParse'

export interface TaskDraft {
  task_type: string
  planned_date_start: string | null
  planned_date_end: string | null
  notes?: string
}

const MISSING_DATA_NOTE = '品種の時期情報が不足しているため手動で設定してください'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parts = value.split('-').map(Number)
  const [y, m, d] = parts
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function toDateStr(date: Date | null): string | null {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function midpoint(period: ParsedPeriod): Date {
  const t = (period.start.getTime() + period.end.getTime()) / 2
  return new Date(t)
}

function needsSeedling(variety: Variety): boolean {
  return Boolean(variety.seedling_days)
}

// 植付(育苗が必要な品種)/直まき(不要な品種)の基準日 B。
// 優先順位: 実績植付日 → 計画植付日 → (直まき品種のみ)実績種蒔き日 → 計画種蒔き日
//          → 栽培暦の植付時期をパースした中央日 → null
function resolveBaseDate(
  planting: Planting,
  variety: Variety,
  regionCal: RegionCalendar | undefined,
): Date | null {
  const actualTransplant = parseDate(planting.actual_transplant_date)
  if (actualTransplant) return actualTransplant
  const plannedTransplant = parseDate(planting.planned_transplant_date)
  if (plannedTransplant) return plannedTransplant

  if (!needsSeedling(variety)) {
    const actualSowing = parseDate(planting.actual_sowing_date)
    if (actualSowing) return actualSowing
    const plannedSowing = parseDate(planting.planned_sowing_date)
    if (plannedSowing) return plannedSowing
  }

  const parsed = parsePeriodText(regionCal?.transplanting, planting.year)
  if (parsed) return midpoint(parsed)

  return null
}

// 種蒔き基準日 S(育苗が必要な品種の場合のみ使用)。
// 優先順位: 実績種蒔き日 → 計画種蒔き日 → 栽培暦の種蒔き時期をパースした中央日
//          → 基準日B - seedling_days日 → null
function resolveSowingDate(
  planting: Planting,
  variety: Variety,
  regionCal: RegionCalendar | undefined,
  baseDate: Date | null,
): Date | null {
  const actualSowing = parseDate(planting.actual_sowing_date)
  if (actualSowing) return actualSowing
  const plannedSowing = parseDate(planting.planned_sowing_date)
  if (plannedSowing) return plannedSowing

  const parsed = parsePeriodText(regionCal?.sowing, planting.year)
  if (parsed) return midpoint(parsed)

  if (baseDate && variety.seedling_days) return addDays(baseDate, -variety.seedling_days)

  return null
}

// 収穫開始/終了(H_start/H_end)。開始・終了それぞれ独立に実績→計画の優先順位で解決したうえで、
// どちらも未確定なら栽培暦の収穫時期をパースした範囲を採用し、それも無ければ
// 基準日B + days_to_harvest日を開始日、そこから14日後を終了日とする(spec.mdの想定するデフォルト収穫期間)。
// 片方だけ実績/計画が入っている場合(例: 開始日だけ実績記録済み)は、もう片方は
// 「開始日+14日」等で補完する(収穫タスクの表示に開始・終了の両方が必要なため)。
function resolveHarvestRange(
  planting: Planting,
  variety: Variety,
  regionCal: RegionCalendar | undefined,
  baseDate: Date | null,
): { start: Date | null; end: Date | null } {
  let start =
    parseDate(planting.actual_harvest_start_date) ?? parseDate(planting.planned_harvest_start_date)
  let end = parseDate(planting.actual_harvest_end_date) ?? parseDate(planting.planned_harvest_end_date)

  if (!start && !end) {
    const parsed = parsePeriodText(regionCal?.harvest, planting.year)
    if (parsed) {
      start = parsed.start
      end = parsed.end
    }
  }

  if (!start && baseDate && variety.days_to_harvest) {
    start = addDays(baseDate, variety.days_to_harvest)
  }
  if (!end && start) {
    end = addDays(start, 14)
  }

  return { start: start ?? null, end: end ?? null }
}

function draft(
  task_type: string,
  start: Date | null,
  end: Date | null,
  hasRequiredInput: boolean,
): TaskDraft {
  return {
    task_type,
    planned_date_start: toDateStr(start),
    planned_date_end: toDateStr(end),
    ...(hasRequiredInput ? {} : { notes: MISSING_DATA_NOTE }),
  }
}

// 作付け・品種・気候帯から、作業タスク候補一覧を生成する(spec.md 4.4のタスク列挙順)。
// 生成される順序・種類:
//   1. 土作り (B-14〜B-7)
//   2. 畝立て (B-7〜B-3)
//   3. 種蒔き (S, 育苗が必要な品種のみ)
//   4. 育苗管理 (S〜B-1, 育苗が必要な品種のみ)
//   5. マルチング/保温対策 (B-3〜B-1, mulch_typeまたはprotection_notesが設定されている場合のみ)
//   6. 植え付け(育苗要) または 種蒔き(直まき)(いずれもB単日)
//   7. 誘引・整枝・追肥 (B+14 〜 H_start-7 or B+30)
//   8. 収穫 (H_start〜H_end)
//   9. 片付け (H_end+1〜H_end+7)
export function generateTasks(planting: Planting, variety: Variety, climateZone: ClimateZone): TaskDraft[] {
  const regionCal = variety.cultivation_calendar?.[climateZone]
  const seedlingRequired = needsSeedling(variety)

  const baseDate = resolveBaseDate(planting, variety, regionCal)
  const sowingDate = seedlingRequired ? resolveSowingDate(planting, variety, regionCal, baseDate) : null
  const { start: hStart, end: hEnd } = resolveHarvestRange(planting, variety, regionCal, baseDate)

  const tasks: TaskDraft[] = []

  tasks.push(
    draft('土作り', baseDate && addDays(baseDate, -14), baseDate && addDays(baseDate, -7), Boolean(baseDate)),
  )
  tasks.push(
    draft('畝立て', baseDate && addDays(baseDate, -7), baseDate && addDays(baseDate, -3), Boolean(baseDate)),
  )

  if (seedlingRequired) {
    tasks.push(draft('種蒔き', sowingDate, sowingDate, Boolean(sowingDate)))
    const seedlingCareEnd = baseDate && addDays(baseDate, -1)
    tasks.push(draft('育苗管理', sowingDate, seedlingCareEnd, Boolean(sowingDate && seedlingCareEnd)))
  }

  if (variety.mulch_type || variety.protection_notes) {
    tasks.push(
      draft(
        'マルチング/保温対策',
        baseDate && addDays(baseDate, -3),
        baseDate && addDays(baseDate, -1),
        Boolean(baseDate),
      ),
    )
  }

  const finalStepLabel = seedlingRequired ? '植え付け' : '種蒔き（直まき）'
  tasks.push(draft(finalStepLabel, baseDate, baseDate, Boolean(baseDate)))

  const tendingStart = baseDate && addDays(baseDate, 14)
  const tendingEnd = hStart ? addDays(hStart, -7) : baseDate && addDays(baseDate, 30)
  tasks.push(draft('誘引・整枝・追肥', tendingStart, tendingEnd, Boolean(tendingStart && tendingEnd)))

  tasks.push(draft('収穫', hStart, hEnd, Boolean(hStart && hEnd)))

  tasks.push(
    draft('片付け', hEnd && addDays(hEnd, 1), hEnd && addDays(hEnd, 7), Boolean(hEnd)),
  )

  return tasks
}
