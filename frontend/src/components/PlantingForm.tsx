import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createPlanting, deletePlanting, updatePlanting } from '../api/plantings'
import { ApiError } from '../api/client'
import type { BedSegment, Planting, PlantingStatus, Variety } from '../api/types'
import { resolveVariety } from '../utils/resolve'
import type { Lookups } from '../utils/resolve'
import { checkRotation } from '../utils/rotation'

const STATUS_OPTIONS: PlantingStatus[] = ['計画', '育苗中', '植付済', '収穫中', '完了']

interface PlantingFormProps {
  segment: BedSegment
  varieties: Variety[]
  lookups: Lookups
  // 同一区画の他のPlanting一覧(輪作チェック用)。編集対象自身が含まれていてもよい(内部で除外する)。
  existingPlantings: Planting[]
  initialPlanting?: Planting | null
  defaultYear: number
  onSaved: (planting: Planting) => void
  onCancel: () => void
  onDeleted?: (plantingId: number) => void
}

function varietyOptionLabel(variety: Variety, lookups: Lookups): string {
  const { crop, cropFamily } = resolveVariety(variety.id, lookups)
  const parts = [crop?.name, cropFamily?.name].filter((v): v is string => Boolean(v))
  return parts.length > 0 ? `${variety.name}（${parts.join('・')}）` : variety.name
}

function PlantingForm({
  segment,
  varieties,
  lookups,
  existingPlantings,
  initialPlanting,
  defaultYear,
  onSaved,
  onCancel,
  onDeleted,
}: PlantingFormProps) {
  const isEdit = initialPlanting != null

  const [varietyId, setVarietyId] = useState<string>(
    initialPlanting ? String(initialPlanting.variety_id) : varieties[0] ? String(varieties[0].id) : '',
  )
  const [year, setYear] = useState(String(initialPlanting?.year ?? defaultYear))
  const [status, setStatus] = useState<PlantingStatus>(initialPlanting?.status ?? '計画')
  const [notes, setNotes] = useState(initialPlanting?.notes ?? '')

  const [plannedSowing, setPlannedSowing] = useState(initialPlanting?.planned_sowing_date ?? '')
  const [plannedTransplant, setPlannedTransplant] = useState(
    initialPlanting?.planned_transplant_date ?? '',
  )
  const [plannedHarvestStart, setPlannedHarvestStart] = useState(
    initialPlanting?.planned_harvest_start_date ?? '',
  )
  const [plannedHarvestEnd, setPlannedHarvestEnd] = useState(
    initialPlanting?.planned_harvest_end_date ?? '',
  )

  const hasInitialActuals = Boolean(
    initialPlanting?.actual_sowing_date ||
      initialPlanting?.actual_transplant_date ||
      initialPlanting?.actual_harvest_start_date ||
      initialPlanting?.actual_harvest_end_date,
  )
  const [showActuals, setShowActuals] = useState(hasInitialActuals)
  const [actualSowing, setActualSowing] = useState(initialPlanting?.actual_sowing_date ?? '')
  const [actualTransplant, setActualTransplant] = useState(
    initialPlanting?.actual_transplant_date ?? '',
  )
  const [actualHarvestStart, setActualHarvestStart] = useState(
    initialPlanting?.actual_harvest_start_date ?? '',
  )
  const [actualHarvestEnd, setActualHarvestEnd] = useState(
    initialPlanting?.actual_harvest_end_date ?? '',
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 品種・年を変更するたびにリアルタイムで輪作障害チェックを行う(非ブロッキング警告)。
  const rotationResult = useMemo(() => {
    const yearNum = Number(year)
    if (!varietyId || !Number.isFinite(yearNum)) return { warning: false as const }
    const others = existingPlantings.filter((p) => p.id !== initialPlanting?.id)
    return checkRotation(Number(varietyId), yearNum, others, lookups)
  }, [varietyId, year, existingPlantings, lookups, initialPlanting])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!varietyId) {
      setError('品種を選択してください')
      return
    }
    const yearNum = Number(year)
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2999) {
      setError('年は正しい数値で入力してください')
      return
    }

    setSaving(true)
    try {
      const payload = {
        bed_segment_id: segment.id,
        variety_id: Number(varietyId),
        year: yearNum,
        planned_sowing_date: plannedSowing || null,
        actual_sowing_date: actualSowing || null,
        planned_transplant_date: plannedTransplant || null,
        actual_transplant_date: actualTransplant || null,
        planned_harvest_start_date: plannedHarvestStart || null,
        actual_harvest_start_date: actualHarvestStart || null,
        planned_harvest_end_date: plannedHarvestEnd || null,
        actual_harvest_end_date: actualHarvestEnd || null,
        status,
        notes: notes.trim() || null,
      }
      const saved = initialPlanting
        ? await updatePlanting(initialPlanting.id, payload)
        : await createPlanting(payload)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialPlanting) return
    if (!window.confirm(`${initialPlanting.year}年の作付けを削除しますか？`)) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await deletePlanting(initialPlanting.id)
      onDeleted?.(initialPlanting.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました')
      setSaving(false)
    }
  }

  return (
    <form className="entity-form planting-form" onSubmit={handleSubmit}>
      <h3>{isEdit ? '作付けを編集' : '作付けを登録'}</h3>

      <label>
        品種
        <select value={varietyId} onChange={(e) => setVarietyId(e.target.value)}>
          {varieties.length === 0 && <option value="">(品種がありません)</option>}
          {varieties.map((v) => (
            <option key={v.id} value={v.id}>
              {varietyOptionLabel(v, lookups)}
            </option>
          ))}
        </select>
      </label>

      <label>
        年
        <input type="number" step="1" value={year} onChange={(e) => setYear(e.target.value)} />
      </label>

      {rotationResult.warning && (
        <p className="rotation-warning" role="alert">
          ⚠ {rotationResult.message}
        </p>
      )}

      <label>
        ステータス
        <select value={status} onChange={(e) => setStatus(e.target.value as PlantingStatus)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="calendar-fieldset">
        <legend>計画（予定日）</legend>
        <label>
          種蒔き予定日
          <input
            type="date"
            value={plannedSowing ?? ''}
            onChange={(e) => setPlannedSowing(e.target.value)}
          />
        </label>
        <label>
          植付予定日
          <input
            type="date"
            value={plannedTransplant ?? ''}
            onChange={(e) => setPlannedTransplant(e.target.value)}
          />
        </label>
        <label>
          収穫開始予定日
          <input
            type="date"
            value={plannedHarvestStart ?? ''}
            onChange={(e) => setPlannedHarvestStart(e.target.value)}
          />
        </label>
        <label>
          収穫終了予定日
          <input
            type="date"
            value={plannedHarvestEnd ?? ''}
            onChange={(e) => setPlannedHarvestEnd(e.target.value)}
          />
        </label>
      </fieldset>

      {!showActuals ? (
        <button type="button" onClick={() => setShowActuals(true)}>
          + 実績を記録
        </button>
      ) : (
        <fieldset className="calendar-fieldset">
          <legend>実績（実施日）</legend>
          <label>
            種蒔き実績日
            <input
              type="date"
              value={actualSowing ?? ''}
              onChange={(e) => setActualSowing(e.target.value)}
            />
          </label>
          <label>
            植付実績日
            <input
              type="date"
              value={actualTransplant ?? ''}
              onChange={(e) => setActualTransplant(e.target.value)}
            />
          </label>
          <label>
            収穫開始実績日
            <input
              type="date"
              value={actualHarvestStart ?? ''}
              onChange={(e) => setActualHarvestStart(e.target.value)}
            />
          </label>
          <label>
            収穫終了実績日
            <input
              type="date"
              value={actualHarvestEnd ?? ''}
              onChange={(e) => setActualHarvestEnd(e.target.value)}
            />
          </label>
        </fieldset>
      )}

      <label>
        メモ(任意)
        <textarea rows={2} value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          キャンセル
        </button>
        {isEdit && (
          <button type="button" className="danger-button" onClick={handleDelete} disabled={saving}>
            削除
          </button>
        )}
      </div>
    </form>
  )
}

export default PlantingForm
