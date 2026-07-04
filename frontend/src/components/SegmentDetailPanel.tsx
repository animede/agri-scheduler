import type { BedSegment, Planting } from '../api/types'
import { pickCurrentPlanting, sortHistory } from '../utils/planting'
import { resolveVariety } from '../utils/resolve'
import type { Lookups } from '../utils/resolve'

interface SegmentDetailPanelProps {
  segment: BedSegment
  plantings: Planting[]
  lookups: Lookups
  currentYear: number
  onClose: () => void
}

function describePlanting(planting: Planting, lookups: Lookups): string {
  const { variety, crop } = resolveVariety(planting.variety_id, lookups)
  const varietyName = variety?.name ?? `品種#${planting.variety_id}(不明)`
  return crop ? `${varietyName}（${crop.name}）` : varietyName
}

function SegmentDetailPanel({
  segment,
  plantings,
  lookups,
  currentYear,
  onClose,
}: SegmentDetailPanelProps) {
  const current = pickCurrentPlanting(plantings, currentYear)
  const history = sortHistory(plantings, current)

  return (
    <div className="segment-detail-panel">
      <div className="panel-header">
        <h4>区画詳細: {segment.name ?? `区画#${segment.id}`}</h4>
        <button type="button" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>
      <p className="muted">
        位置: {segment.start_offset_m}m 〜 {segment.start_offset_m + segment.length_m}m（長さ{' '}
        {segment.length_m}m）
      </p>

      <section>
        <h5>現在の作付け</h5>
        {current ? (
          <p>
            {describePlanting(current, lookups)} / {current.year}年 / ステータス: {current.status}
          </p>
        ) : (
          <p className="muted">現在の作付けはありません（空き区画）。</p>
        )}
      </section>

      <section>
        <h5>過去の作付け履歴</h5>
        {history.length === 0 ? (
          <p className="muted">履歴はありません。</p>
        ) : (
          <ul className="history-list">
            {history.map((p) => (
              <li key={p.id}>
                {p.year}年: {describePlanting(p, lookups)} / {p.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default SegmentDetailPanel
