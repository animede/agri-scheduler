import { useMemo, useState } from 'react'
import type { BedSegment, Planting, Variety } from '../api/types'
import { createPlanting } from '../api/plantings'
import { createTask } from '../api/tasks'
import { ApiError } from '../api/client'
import { resolveVariety } from '../utils/resolve'
import type { Lookups } from '../utils/resolve'
import { checkRotation } from '../utils/rotation'
import type { RolloverRow } from '../utils/rollover'
import { generateTasks } from '../utils/taskTemplate'
import { getClimateZone } from '../utils/settings'
import './RolloverReviewModal.css'

interface RolloverReviewModalProps {
  rows: RolloverRow[]
  // ロール元の年(selectedYear)。翌年 = year + 1 向けの計画を作成する。
  year: number
  plantingsBySegment: Map<number, Planting[]>
  varieties: Variety[]
  lookups: Lookups
  bedNameFor: (segment: BedSegment) => string
  onClose: () => void
  // 1件以上の作成に成功した際、呼び出し側でマップ/カレンダーのデータを再読み込みするために呼ばれる。
  onCreated: () => void
  // 対象行すべての作成が(エラーなく)完了した際に呼ばれる。呼び出し側でselectedYearの切り替え・
  // モーダルのクローズを行う想定。
  onAllDone: (nextYear: number) => void
}

interface RowState {
  varietyId: string
  included: boolean
}

function describeCurrent(row: RolloverRow, lookups: Lookups): string {
  const { variety } = resolveVariety(row.currentPlanting.variety_id, lookups)
  const varietyName = variety?.name ?? `品種#${row.currentPlanting.variety_id}(不明)`
  return row.currentCropFamilyName ? `${varietyName}（${row.currentCropFamilyName}）` : varietyName
}

function candidateOptionLabel(row: RolloverRow, varietyId: number): string {
  const candidate = row.candidates.find((c) => c.variety.id === varietyId)
  if (!candidate) return ''
  const familyLabel = candidate.cropFamilyName ? `（${candidate.cropFamilyName}）` : ''
  const mark = candidate.rotationCheck.warning ? '⚠ ' : ''
  return `${mark}${candidate.variety.name}${familyLabel}`
}

function buildInitialRowStates(rows: RolloverRow[]): Record<number, RowState> {
  const result: Record<number, RowState> = {}
  for (const row of rows) {
    result[row.segment.id] = {
      varietyId: row.defaultVarietyId != null ? String(row.defaultVarietyId) : '',
      // 既に翌年の計画がある場合は二重登録を避けるためデフォルトでチェックを外す
      included: row.existingNextYearPlantings.length === 0,
    }
  }
  return result
}

function RolloverReviewModal({
  rows,
  year,
  plantingsBySegment,
  varieties,
  lookups,
  bedNameFor,
  onClose,
  onCreated,
  onAllDone,
}: RolloverReviewModalProps) {
  const nextYear = year + 1
  const [rowStates, setRowStates] = useState<Record<number, RowState>>(() => buildInitialRowStates(rows))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const varietyById = useMemo(() => new Map(varieties.map((v) => [v.id, v])), [varieties])

  function setRowState(segmentId: number, patch: Partial<RowState>) {
    setRowStates((prev) => ({
      ...prev,
      [segmentId]: { ...prev[segmentId], ...patch },
    }))
  }

  // 提案品種を変更するたびに、その場でcheckRotationを呼び直して警告の有無を再表示する。
  function liveCheck(row: RolloverRow, varietyIdStr: string) {
    const varietyId = Number(varietyIdStr)
    if (!varietyIdStr || !Number.isFinite(varietyId)) return { warning: false as const }
    const segmentPlantings = plantingsBySegment.get(row.segment.id) ?? []
    return checkRotation(varietyId, nextYear, segmentPlantings, lookups)
  }

  const includedCount = rows.filter((row) => rowStates[row.segment.id]?.included).length

  async function handleCreate() {
    setSaving(true)
    setErrors([])
    const failedSegmentIds: number[] = []
    const messages: string[] = []

    for (const row of rows) {
      const state = rowStates[row.segment.id]
      if (!state?.included) continue
      const varietyId = Number(state.varietyId)
      if (!varietyId || !Number.isFinite(varietyId)) {
        failedSegmentIds.push(row.segment.id)
        messages.push(`${bedNameFor(row.segment)} / ${row.segment.name ?? `区画#${row.segment.id}`}: 品種が選択されていません`)
        continue
      }
      try {
        const planting = await createPlanting({
          bed_segment_id: row.segment.id,
          variety_id: varietyId,
          year: nextYear,
          planned_sowing_date: null,
          actual_sowing_date: null,
          planned_transplant_date: null,
          actual_transplant_date: null,
          planned_harvest_start_date: null,
          actual_harvest_start_date: null,
          planned_harvest_end_date: null,
          actual_harvest_end_date: null,
          status: '計画',
          notes: null,
        })

        const variety = varietyById.get(varietyId)
        if (variety) {
          const drafts = generateTasks(planting, variety, getClimateZone())
          await Promise.all(
            drafts.map((d) =>
              createTask({
                planting_id: planting.id,
                task_type: d.task_type,
                planned_date_start: d.planned_date_start,
                planned_date_end: d.planned_date_end,
                actual_date: null,
                is_completed: false,
                notes: d.notes ?? null,
              }),
            ),
          )
        }
      } catch (err) {
        failedSegmentIds.push(row.segment.id)
        const message = err instanceof ApiError ? err.message : '作成に失敗しました'
        messages.push(`${bedNameFor(row.segment)} / ${row.segment.name ?? `区画#${row.segment.id}`}: ${message}`)
      }
    }

    setSaving(false)

    const anySucceeded = rows.some(
      (row) => rowStates[row.segment.id]?.included && !failedSegmentIds.includes(row.segment.id),
    )
    if (anySucceeded) onCreated()

    if (failedSegmentIds.length > 0) {
      setErrors(messages)
      // 成功した行はチェックを外し、再実行時に失敗した行だけを対象にできるようにする
      setRowStates((prev) => {
        const next = { ...prev }
        for (const row of rows) {
          if (!failedSegmentIds.includes(row.segment.id) && next[row.segment.id]) {
            next[row.segment.id] = { ...next[row.segment.id], included: false }
          }
        }
        return next
      })
      return
    }

    onAllDone(nextYear)
  }

  return (
    <div className="rollover-modal-overlay" role="dialog" aria-modal="true" aria-label="次年度にロール">
      <div className="rollover-modal">
        <div className="rollover-modal-header">
          <h3>
            {year}年 → {nextYear}年 へロール
          </h3>
          <button type="button" onClick={onClose} aria-label="閉じる" disabled={saving}>
            ×
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="muted">{year}年にロール対象の作付けがありません。</p>
        ) : (
          <>
            <p className="muted">
              {year}年に作付けのある区画について、輪作年限を踏まえた{nextYear}年の候補品種を提示します。
              提案品種は変更でき、変更するとその場で輪作警告の有無を再表示します。
            </p>

            <div className="rollover-table-wrap">
              <table className="rollover-table">
                <thead>
                  <tr>
                    <th>区画</th>
                    <th>{year}年の作付け</th>
                    <th>{nextYear}年の提案品種</th>
                    <th>状態</th>
                    <th>含める</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const state = rowStates[row.segment.id] ?? { varietyId: '', included: false }
                    const check = liveCheck(row, state.varietyId)
                    const alreadyExists = row.existingNextYearPlantings.length > 0
                    return (
                      <tr key={row.segment.id}>
                        <td>
                          {bedNameFor(row.segment)} / {row.segment.name ?? `区画#${row.segment.id}`}
                        </td>
                        <td>{describeCurrent(row, lookups)}</td>
                        <td>
                          {row.candidates.length === 0 ? (
                            <span className="muted">(品種マスタがありません)</span>
                          ) : (
                            <select
                              value={state.varietyId}
                              onChange={(e) => setRowState(row.segment.id, { varietyId: e.target.value })}
                              disabled={saving}
                            >
                              {row.candidates.map((c) => (
                                <option key={c.variety.id} value={c.variety.id}>
                                  {candidateOptionLabel(row, c.variety.id)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          {!row.hasSafeCandidate && (
                            <p className="rollover-status rollover-status--danger">⚠ 候補なし（要検討）</p>
                          )}
                          {check.warning ? (
                            <p className="rollover-status rollover-status--warning">⚠ {check.message}</p>
                          ) : (
                            row.candidates.length > 0 && (
                              <p className="rollover-status rollover-status--ok">輪作警告なし</p>
                            )
                          )}
                          {alreadyExists && (
                            <p className="rollover-status rollover-status--info">
                              既に{nextYear}年の計画があります
                            </p>
                          )}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={state.included}
                            disabled={saving || row.candidates.length === 0}
                            onChange={(e) => setRowState(row.segment.id, { included: e.target.checked })}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {errors.length > 0 && (
          <div className="form-error">
            <p>一部の区画で作成に失敗しました:</p>
            <ul>
              {errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="form-actions">
          {rows.length > 0 && (
            <button type="button" onClick={() => void handleCreate()} disabled={saving || includedCount === 0}>
              {saving ? '作成中...' : `${nextYear}年計画を作成(${includedCount}件)`}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={saving}>
            {rows.length === 0 ? '閉じる' : 'キャンセル'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RolloverReviewModal
