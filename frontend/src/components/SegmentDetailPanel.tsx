import { useState } from 'react'
import type { BedSegment, Planting, Variety } from '../api/types'
import { deletePlanting } from '../api/plantings'
import { ApiError } from '../api/client'
import { pickCurrentPlanting, sortHistory } from '../utils/planting'
import { resolveVariety } from '../utils/resolve'
import type { Lookups } from '../utils/resolve'
import { checkCurrentRotationRisk } from '../utils/rotation'
import PlantingForm from './PlantingForm'

interface SegmentDetailPanelProps {
  segment: BedSegment
  plantings: Planting[]
  varieties: Variety[]
  lookups: Lookups
  currentYear: number
  onClose: () => void
  // 作付けの登録・編集・削除後に呼ばれる。呼び出し側で一覧の再読み込みを行う想定。
  onChanged: () => void
}

type PanelMode = { kind: 'view' } | { kind: 'new' } | { kind: 'edit'; planting: Planting }

function describePlanting(planting: Planting, lookups: Lookups): string {
  const { variety, crop } = resolveVariety(planting.variety_id, lookups)
  const varietyName = variety?.name ?? `品種#${planting.variety_id}(不明)`
  return crop ? `${varietyName}（${crop.name}）` : varietyName
}

function SegmentDetailPanel({
  segment,
  plantings,
  varieties,
  lookups,
  currentYear,
  onClose,
  onChanged,
}: SegmentDetailPanelProps) {
  const [mode, setMode] = useState<PanelMode>({ kind: 'view' })
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const current = pickCurrentPlanting(plantings, currentYear)
  const history = sortHistory(plantings, current)
  const currentRisk = current
    ? checkCurrentRotationRisk(plantings, current, lookups)
    : ({ warning: false } as const)

  async function handleDelete(planting: Planting) {
    if (
      !window.confirm(
        `${planting.year}年の作付け(${describePlanting(planting, lookups)})を削除しますか？`,
      )
    ) {
      return
    }
    setDeleteError(null)
    try {
      await deletePlanting(planting.id)
      onChanged()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : '削除に失敗しました')
    }
  }

  if (mode.kind !== 'view') {
    return (
      <div className="segment-detail-panel">
        <div className="panel-header">
          <h4>区画詳細: {segment.name ?? `区画#${segment.id}`}</h4>
          <button type="button" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <PlantingForm
          segment={segment}
          varieties={varieties}
          lookups={lookups}
          existingPlantings={plantings}
          initialPlanting={mode.kind === 'edit' ? mode.planting : null}
          defaultYear={currentYear}
          onSaved={() => {
            setMode({ kind: 'view' })
            onChanged()
          }}
          onCancel={() => setMode({ kind: 'view' })}
          onDeleted={() => {
            setMode({ kind: 'view' })
            onChanged()
          }}
        />
      </div>
    )
  }

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

      {deleteError && <p className="form-error">{deleteError}</p>}

      <section>
        <h5>現在の作付け</h5>
        {current ? (
          <>
            <p>
              {describePlanting(current, lookups)} / {current.year}年 / ステータス: {current.status}
            </p>
            {currentRisk.warning && (
              <p className="rotation-warning" role="alert">
                ⚠ {currentRisk.message}
              </p>
            )}
            <div className="form-actions">
              <button type="button" onClick={() => setMode({ kind: 'edit', planting: current })}>
                編集
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleDelete(current)}
              >
                削除
              </button>
            </div>
          </>
        ) : (
          <p className="muted">現在の作付けはありません（空き区画）。</p>
        )}
      </section>

      <button type="button" onClick={() => setMode({ kind: 'new' })}>
        + 作付けを登録
      </button>

      <section>
        <h5>過去の作付け履歴</h5>
        {history.length === 0 ? (
          <p className="muted">履歴はありません。</p>
        ) : (
          <ul className="history-list">
            {history.map((p) => (
              <li key={p.id} className="history-row">
                <span>
                  {p.year}年: {describePlanting(p, lookups)} / {p.status}
                </span>
                <span className="segment-row-actions">
                  <button type="button" onClick={() => setMode({ kind: 'edit', planting: p })}>
                    編集
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleDelete(p)}
                  >
                    削除
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default SegmentDetailPanel
