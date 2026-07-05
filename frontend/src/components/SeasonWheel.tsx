import type { BedSegment, Planting, Task } from '../api/types'
import type { Lookups } from '../utils/resolve'
import { resolveVariety } from '../utils/resolve'
import { colorForCropFamily, EMPTY_SEGMENT_COLOR } from '../utils/cropFamilyColor'
import { dateToAngle, donutSectorPath, polarToCartesian } from '../utils/seasonWheelGeometry'
import './SeasonWheel.css'

// 圃場マップのSVGとは別に、1年間(1〜12月)を円周上に配置した「シーズンホイール」
// (spec.md 4.6「栽培カレンダービュー」)。ガントチャートのような行×列のグリッドではなく、
// 区画ごとに1本の同心円リングを割り当て、その中にPlanting期間をドーナツ扇形として描画する。

export interface SeasonWheelRingData {
  segment: BedSegment
  bedName: string
  // その区画の、選択年のPlantingのみ(呼び出し側でフィルタ済み)。
  plantings: Planting[]
}

interface SeasonWheelProps {
  rings: SeasonWheelRingData[]
  year: number
  // Planting.id -> そのPlantingに紐づくTask一覧。
  tasksByPlanting: Map<number, Task[]>
  lookups: Lookups
  selectedSegmentId: number | null
  onSelectSegment: (segmentId: number) => void
}

const HOLE_RADIUS = 46
const RING_WIDTH = 28
const RING_GAP = 6
const OUTER_MARGIN = 34

const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

interface StageMarker {
  emoji: string
  angle: number
  title: string
}

interface PlantingRange {
  planting: Planting
  startAngle: number
  endAngle: number
  color: string
  label: string
  stageMarkers: StageMarker[]
  undated: boolean
}

// Planting1件分の描画範囲を決定する。
// 優先順位: 紐づくTaskのplanned_date_start最小値〜planned_date_end最大値
//          -> Planting自体のplanned_sowing_date〜planned_harvest_end_date等
//          -> どちらも無ければ「日程未定」として扱う(呼び出し側で点として描画)。
function resolvePlantingRange(planting: Planting, tasks: Task[], lookups: Lookups): PlantingRange {
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
    const angle = dateToAngle(dateStr)
    if (angle == null) return
    stageMarkers.push({ emoji, angle, title: `${t.task_type}: ${dateStr}` })
  }
  addMarker('種蒔き', '🌱')
  addMarker('植え付け', '🌿')
  addMarker('収穫', '🌾')

  if (!startStr || !endStr) {
    return { planting, startAngle: -90, endAngle: -90, color, label, stageMarkers, undated: true }
  }

  const startAngle = dateToAngle(startStr)
  let endAngle = dateToAngle(endStr)
  if (startAngle == null || endAngle == null) {
    return { planting, startAngle: -90, endAngle: -90, color, label, stageMarkers, undated: true }
  }
  if (endAngle < startAngle) endAngle += 360
  if (endAngle - startAngle < 1.5) endAngle = startAngle + 1.5 // 単日タスクでも視認できる最小幅を確保

  return { planting, startAngle, endAngle, color, label, stageMarkers, undated: false }
}

function SeasonWheel({
  rings,
  year,
  tasksByPlanting,
  lookups,
  selectedSegmentId,
  onSelectSegment,
}: SeasonWheelProps) {
  if (rings.length === 0) {
    return (
      <div className="season-wheel-empty">
        まだ区画が登録されていません。「+ 畝を追加」から作成してください。
      </div>
    )
  }

  const n = rings.length
  const totalRadius = HOLE_RADIUS + n * (RING_WIDTH + RING_GAP) + OUTER_MARGIN
  const size = totalRadius * 2
  const cx = totalRadius
  const cy = totalRadius
  const monthTickOuter = HOLE_RADIUS + n * (RING_WIDTH + RING_GAP) + 6

  return (
    <svg
      className="season-wheel"
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      role="img"
      aria-label={`${year}年 栽培カレンダー(シーズンホイール)`}
    >
      <circle cx={cx} cy={cy} r={HOLE_RADIUS - 4} className="season-wheel-hole" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="season-wheel-year-label">
        {year}
      </text>

      {MONTH_NAMES.map((label, i) => {
        const angle = (i / 12) * 360 - 90
        const tickInner = polarToCartesian(cx, cy, HOLE_RADIUS, angle)
        const tickOuter = polarToCartesian(cx, cy, monthTickOuter, angle)
        const labelPos = polarToCartesian(cx, cy, monthTickOuter + 14, angle)
        return (
          <g key={label} className="season-wheel-month">
            <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} />
            <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle">
              {label}
            </text>
          </g>
        )
      })}

      {rings.map((ring, idx) => {
        const rInner = HOLE_RADIUS + idx * (RING_WIDTH + RING_GAP)
        const rOuter = rInner + RING_WIDTH
        const rMid = (rInner + rOuter) / 2
        const isSelected = ring.segment.id === selectedSegmentId
        const segmentLabel = ring.segment.name ?? `区画#${ring.segment.id}`
        const select = () => onSelectSegment(ring.segment.id)

        const ranges = ring.plantings.map((p) =>
          resolvePlantingRange(p, tasksByPlanting.get(p.id) ?? [], lookups),
        )

        const ringLabelPos = polarToCartesian(cx, cy, rMid, 180)

        return (
          <g
            key={ring.segment.id}
            className={`season-wheel-ring${isSelected ? ' season-wheel-ring--selected' : ''}`}
          >
            {isSelected && (
              <circle
                cx={cx}
                cy={cy}
                r={rMid}
                className="season-wheel-ring-highlight"
                style={{ strokeWidth: RING_WIDTH + 10 }}
              />
            )}

            {/* ベースの空リング: 区画は存在するが選択年にPlantingが無い場合はこれだけが表示される */}
            <circle
              cx={cx}
              cy={cy}
              r={rMid}
              className="season-wheel-ring-base"
              style={{ strokeWidth: RING_WIDTH }}
              onClick={select}
            >
              <title>{`${ring.bedName} / ${segmentLabel}`}</title>
            </circle>

            {ranges.map((r) =>
              r.undated ? (
                <circle
                  key={r.planting.id}
                  cx={cx}
                  cy={cy - rMid}
                  r={5}
                  fill={r.color}
                  className="season-wheel-undated-marker"
                  onClick={select}
                >
                  <title>{`${segmentLabel}: ${r.label}（${r.planting.year}年 / 日程未定）`}</title>
                </circle>
              ) : (
                <path
                  key={r.planting.id}
                  d={donutSectorPath(cx, cy, rInner, rOuter, r.startAngle, r.endAngle)}
                  fill={r.color}
                  className="season-wheel-arc"
                  onClick={select}
                >
                  <title>{`${segmentLabel}: ${r.label}（${r.planting.year}年）`}</title>
                </path>
              ),
            )}

            {ranges.flatMap((r) =>
              r.stageMarkers.map((marker, mi) => {
                const pos = polarToCartesian(cx, cy, rMid, marker.angle)
                return (
                  <g
                    key={`${r.planting.id}-${mi}`}
                    className="season-wheel-stage-icon-group"
                    onClick={select}
                  >
                    <title>{marker.title}</title>
                    <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="season-wheel-stage-icon">
                      {marker.emoji}
                    </text>
                  </g>
                )
              }),
            )}

            <text
              x={ringLabelPos.x - 6}
              y={ringLabelPos.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="season-wheel-ring-label"
            >
              {segmentLabel}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default SeasonWheel
