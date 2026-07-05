import type { Bed, BedSegment, Planting, Task } from '../api/types'
import type { Lookups } from '../utils/resolve'
import { resolveVariety } from '../utils/resolve'
import { colorForCropFamily, EMPTY_SEGMENT_COLOR } from '../utils/cropFamilyColor'
import { dateToX, monthStartXs } from '../utils/timelineGeometry'
import './SeasonTimeline.css'

// 圃場マップのSVGとは別に、1年間(1月〜12月)を左→右のタイムラインとして配置した
// 「栽培カレンダー」ビュー(spec.md 4.6)。旧SeasonWheel(円環)を置き換えたもので、
// 畝ごとにグループ化した行(畝名見出し行 + 区画ごとの1行)に、Planting期間を
// 角丸バーとして描画する。

export interface SeasonTimelineSegmentData {
  segment: BedSegment
  // その区画の、選択年のPlantingのみ(呼び出し側でフィルタ済み)。
  plantings: Planting[]
}

export interface SeasonTimelineBedGroup {
  bed: Bed
  segments: SeasonTimelineSegmentData[]
}

interface SeasonTimelineProps {
  groups: SeasonTimelineBedGroup[]
  year: number
  // Planting.id -> そのPlantingに紐づくTask一覧。
  tasksByPlanting: Map<number, Task[]>
  lookups: Lookups
  selectedSegmentId: number | null
  onSelectSegment: (segmentId: number) => void
}

// --- レイアウト定数 ---
const LABEL_WIDTH = 140 // 左側の畝名/区画名ラベル列の固定幅
const RIGHT_PADDING = 16
const CHART_WIDTH = 760 // ラベル列を除いたタイムライン本体の幅(viewBox内座標)
const VIEWBOX_WIDTH = LABEL_WIDTH + CHART_WIDTH + RIGHT_PADDING

const HEADER_HEIGHT = 30 // 月名ヘッダー行の高さ
const BED_ROW_HEIGHT = 26 // 畝名見出し行の高さ
const SEGMENT_ROW_HEIGHT = 34 // 区画1行の高さ
const BAR_HEIGHT = 20
const BOTTOM_PADDING = 8

const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

interface StageMarker {
  emoji: string
  x: number
  title: string
}

interface PlantingRange {
  planting: Planting
  startX: number
  endX: number
  color: string
  label: string
  stageMarkers: StageMarker[]
  undated: boolean
}

// Planting1件分の描画範囲(X座標)を決定する。
// 優先順位: 紐づくTaskのplanned_date_start最小値〜planned_date_end最大値
//          -> Planting自体のplanned_sowing_date〜planned_harvest_end_date等
//          -> どちらも無ければ「日程未定」として扱う(呼び出し側で点/マーカーとして描画)。
function resolvePlantingRange(
  planting: Planting,
  tasks: Task[],
  lookups: Lookups,
  chartWidth: number,
  year: number,
): PlantingRange {
  const { variety, cropFamily } = resolveVariety(planting.variety_id, lookups)
  const color = cropFamily ? colorForCropFamily(cropFamily.name) : EMPTY_SEGMENT_COLOR
  const label = variety?.name ?? `品種#${planting.variety_id}(不明)`

  const starts: string[] = []
  const ends: string[] = []
  for (const t of tasks) {
    if (t.planned_date_start) starts.push(t.planned_date_start)
    const end = t.planned_date_end ?? t.planned_date_start
    if (end) ends.push(end)
  }
  let startStr: string | null = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null
  let endStr: string | null = ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : null

  if (!startStr) {
    startStr = planting.planned_sowing_date ?? planting.planned_transplant_date ?? null
  }
  if (!endStr) {
    endStr = planting.planned_harvest_end_date ?? planting.planned_harvest_start_date ?? startStr
  }

  const stageMarkers: StageMarker[] = []
  const addMarker = (keyword: string, emoji: string) => {
    const t = tasks.find((x) => x.task_type.includes(keyword))
    if (!t) return
    const dateStr = t.actual_date ?? t.planned_date_start ?? t.planned_date_end
    if (!dateStr) return
    const x = dateToX(dateStr, chartWidth, year)
    if (x == null) return
    stageMarkers.push({ emoji, x, title: `${t.task_type}: ${dateStr}` })
  }
  addMarker('種蒔き', '🌱')
  addMarker('植え付け', '🌿')
  addMarker('収穫', '🌾')

  if (!startStr || !endStr) {
    return { planting, startX: 0, endX: 0, color, label, stageMarkers, undated: true }
  }

  const startX = dateToX(startStr, chartWidth, year)
  let endX = dateToX(endStr, chartWidth, year)
  if (startX == null || endX == null) {
    return { planting, startX: 0, endX: 0, color, label, stageMarkers, undated: true }
  }
  if (endX < startX) endX = startX
  const MIN_BAR_WIDTH = 6
  if (endX - startX < MIN_BAR_WIDTH) endX = startX + MIN_BAR_WIDTH // 単日タスクでも視認できる最小幅を確保

  return { planting, startX, endX, color, label, stageMarkers, undated: false }
}

type Row =
  | { kind: 'bed'; key: string; bedName: string }
  | {
      kind: 'segment'
      key: string
      segment: BedSegment
      segmentLabel: string
      ranges: PlantingRange[]
    }

function estimateTextWidth(text: string): number {
  return text.length * 6.4
}

function SeasonTimeline({
  groups,
  year,
  tasksByPlanting,
  lookups,
  selectedSegmentId,
  onSelectSegment,
}: SeasonTimelineProps) {
  const hasAnySegment = groups.some((g) => g.segments.length > 0)

  if (groups.length === 0 || !hasAnySegment) {
    return (
      <div className="season-timeline-empty">
        まだ区画が登録されていません。「+ 畝を追加」から作成してください。
      </div>
    )
  }

  // 畝見出し + 区画ごとの行を1本のリストに平坦化し、それぞれのY位置を決める。
  const rows: Row[] = []
  for (const group of groups) {
    rows.push({ kind: 'bed', key: `bed-${group.bed.id}`, bedName: group.bed.name })
    for (const seg of group.segments) {
      const ranges = seg.plantings.map((p) =>
        resolvePlantingRange(p, tasksByPlanting.get(p.id) ?? [], lookups, CHART_WIDTH, year),
      )
      rows.push({
        kind: 'segment',
        key: `seg-${seg.segment.id}`,
        segment: seg.segment,
        segmentLabel: seg.segment.name ?? `区画#${seg.segment.id}`,
        ranges,
      })
    }
  }

  let cursorY = HEADER_HEIGHT
  const laidOut = rows.map((row) => {
    const height = row.kind === 'bed' ? BED_ROW_HEIGHT : SEGMENT_ROW_HEIGHT
    const y = cursorY
    cursorY += height
    return { row, y, height }
  })
  const totalHeight = cursorY + BOTTOM_PADDING

  const monthXs = monthStartXs(CHART_WIDTH, year)

  const now = new Date()
  const isCurrentYear = now.getFullYear() === year
  const todayX = isCurrentYear
    ? dateToX(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        CHART_WIDTH,
        year,
      )
    : null

  return (
    <svg
      className="season-timeline"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${totalHeight}`}
      width="100%"
      role="img"
      aria-label={`${year}年 栽培カレンダー(タイムライン)`}
    >
      {/* 月の目盛り線・ラベル(ヘッダー行) */}
      {monthXs.map((x, i) => (
        <g key={MONTH_NAMES[i]} className="season-timeline-month">
          <line
            x1={LABEL_WIDTH + x}
            y1={HEADER_HEIGHT}
            x2={LABEL_WIDTH + x}
            y2={totalHeight}
          />
          <text x={LABEL_WIDTH + x + 3} y={HEADER_HEIGHT - 10} className="season-timeline-month-label">
            {MONTH_NAMES[i]}
          </text>
        </g>
      ))}
      <line
        className="season-timeline-header-rule"
        x1={0}
        y1={HEADER_HEIGHT}
        x2={VIEWBOX_WIDTH}
        y2={HEADER_HEIGHT}
      />

      {laidOut.map(({ row, y, height }) => {
        if (row.kind === 'bed') {
          return (
            <g key={row.key} className="season-timeline-bed-row">
              <rect x={0} y={y} width={VIEWBOX_WIDTH} height={height} className="season-timeline-bed-row-bg" />
              <text x={8} y={y + height / 2} dominantBaseline="middle" className="season-timeline-bed-label">
                {row.bedName}
              </text>
            </g>
          )
        }

        const isSelected = row.segment.id === selectedSegmentId
        const isEmpty = row.ranges.length === 0
        const select = () => onSelectSegment(row.segment.id)
        const barTop = y + (height - BAR_HEIGHT) / 2
        const barMidY = y + height / 2

        return (
          <g
            key={row.key}
            className={`season-timeline-segment-row${isSelected ? ' season-timeline-segment-row--selected' : ''}`}
          >
            <rect
              x={0}
              y={y}
              width={VIEWBOX_WIDTH}
              height={height}
              className={`season-timeline-row-bg${isEmpty ? ' season-timeline-row-bg--empty' : ''}`}
              onClick={select}
            />
            <text
              x={20}
              y={barMidY}
              dominantBaseline="middle"
              className="season-timeline-segment-label"
              onClick={select}
            >
              {row.segmentLabel}
            </text>

            {row.ranges.map((r) =>
              r.undated ? (
                <g key={r.planting.id} onClick={select} className="season-timeline-undated-marker-group">
                  <title>{`${row.segmentLabel}: ${r.label}（${r.planting.year}年 / 日程未定）`}</title>
                  <circle
                    cx={LABEL_WIDTH + 6}
                    cy={barMidY}
                    r={5}
                    fill={r.color}
                    className="season-timeline-undated-marker"
                  />
                </g>
              ) : (
                <g key={r.planting.id} onClick={select} className="season-timeline-bar-group">
                  <title>{`${row.segmentLabel}: ${r.label}（${r.planting.year}年）`}</title>
                  <rect
                    x={LABEL_WIDTH + r.startX}
                    y={barTop}
                    width={Math.max(r.endX - r.startX, 2)}
                    height={BAR_HEIGHT}
                    rx={6}
                    ry={6}
                    fill={r.color}
                    className="season-timeline-bar"
                  />
                  {r.endX - r.startX - 8 >= estimateTextWidth(r.label) && (
                    <text
                      x={LABEL_WIDTH + (r.startX + r.endX) / 2}
                      y={barMidY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="season-timeline-bar-label"
                    >
                      {r.label}
                    </text>
                  )}
                </g>
              ),
            )}

            {row.ranges.flatMap((r) =>
              r.stageMarkers.map((marker, mi) => (
                <g
                  key={`${r.planting.id}-${mi}`}
                  className="season-timeline-stage-icon-group"
                  onClick={select}
                >
                  <title>{marker.title}</title>
                  <text
                    x={LABEL_WIDTH + marker.x}
                    y={barTop - 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="season-timeline-stage-icon"
                  >
                    {marker.emoji}
                  </text>
                </g>
              )),
            )}
          </g>
        )
      })}

      {/* 今日の位置(選択年が現在年の場合のみ) */}
      {todayX != null && (
        <g className="season-timeline-today">
          <line
            x1={LABEL_WIDTH + todayX}
            y1={HEADER_HEIGHT}
            x2={LABEL_WIDTH + todayX}
            y2={totalHeight}
          />
          <text x={LABEL_WIDTH + todayX + 3} y={HEADER_HEIGHT - 10} className="season-timeline-today-label">
            今日
          </text>
        </g>
      )}

      {/* ラベル列とタイムライン本体の区切り線 */}
      <line
        className="season-timeline-label-rule"
        x1={LABEL_WIDTH}
        y1={0}
        x2={LABEL_WIDTH}
        y2={totalHeight}
      />
    </svg>
  )
}

export default SeasonTimeline
