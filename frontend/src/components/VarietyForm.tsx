import { useState } from 'react'
import type { FormEvent } from 'react'
import { createCrop } from '../api/crops'
import { createVariety, deleteVariety, updateVariety } from '../api/varieties'
import { ApiError } from '../api/client'
import type {
  ClimateZone,
  Crop,
  CropFamily,
  CultivationCalendar,
  RegionCalendar,
  Variety,
} from '../api/types'
import { CLIMATE_ZONE_LABELS } from '../utils/settings'
import './VarietyForm.css'

const REGION_ORDER: ClimateZone[] = ['cold', 'temperate', 'warm']

const MULCH_TYPE_SUGGESTIONS = ['黒マルチ', 'シルバーマルチ', '透明マルチ', '無し']

interface VarietyFormProps {
  crops: Crop[]
  cropFamilies: CropFamily[]
  initialVariety?: Variety | null
  defaultClimateZone: ClimateZone
  onSaved: (variety: Variety) => void
  onCancel: () => void
  onDeleted?: (varietyId: number) => void
  onCropCreated: (crop: Crop) => void
}

function regionCalendarFrom(calendar: CultivationCalendar | null, zone: ClimateZone): RegionCalendar {
  const region = calendar?.[zone]
  return {
    sowing: region?.sowing ?? '',
    transplanting: region?.transplanting ?? '',
    harvest: region?.harvest ?? '',
  }
}

function isRegionCalendarEmpty(region: RegionCalendar): boolean {
  return !region.sowing?.trim() && !region.transplanting?.trim() && !region.harvest?.trim()
}

function VarietyForm({
  crops,
  cropFamilies,
  initialVariety,
  defaultClimateZone,
  onSaved,
  onCancel,
  onDeleted,
  onCropCreated,
}: VarietyFormProps) {
  const isEdit = initialVariety != null

  const [cropId, setCropId] = useState<string>(
    initialVariety ? String(initialVariety.crop_id) : crops[0] ? String(crops[0].id) : '',
  )
  const [name, setName] = useState(initialVariety?.name ?? '')

  const [calendar, setCalendar] = useState<Record<ClimateZone, RegionCalendar>>({
    cold: regionCalendarFrom(initialVariety?.cultivation_calendar ?? null, 'cold'),
    temperate: regionCalendarFrom(initialVariety?.cultivation_calendar ?? null, 'temperate'),
    warm: regionCalendarFrom(initialVariety?.cultivation_calendar ?? null, 'warm'),
  })
  const [activeZone, setActiveZone] = useState<ClimateZone>(defaultClimateZone)

  const [seedlingDays, setSeedlingDays] = useState(
    initialVariety?.seedling_days != null ? String(initialVariety.seedling_days) : '',
  )
  const [daysToHarvest, setDaysToHarvest] = useState(
    initialVariety?.days_to_harvest != null ? String(initialVariety.days_to_harvest) : '',
  )
  const [plantSpacingCm, setPlantSpacingCm] = useState(
    initialVariety?.plant_spacing_cm != null ? String(initialVariety.plant_spacing_cm) : '',
  )
  const [rowSpacingCm, setRowSpacingCm] = useState(
    initialVariety?.row_spacing_cm != null ? String(initialVariety.row_spacing_cm) : '',
  )
  const [mulchType, setMulchType] = useState(initialVariety?.mulch_type ?? '')
  const [protectionNotes, setProtectionNotes] = useState(initialVariety?.protection_notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 新規作物の追加ミニフォーム
  const [showNewCropForm, setShowNewCropForm] = useState(false)
  const [newCropName, setNewCropName] = useState('')
  const [newCropFamilyId, setNewCropFamilyId] = useState<string>(
    cropFamilies[0] ? String(cropFamilies[0].id) : '',
  )
  const [newCropSaving, setNewCropSaving] = useState(false)
  const [newCropError, setNewCropError] = useState<string | null>(null)

  function updateRegionField(zone: ClimateZone, field: keyof RegionCalendar, value: string) {
    setCalendar((prev) => ({ ...prev, [zone]: { ...prev[zone], [field]: value } }))
  }

  async function handleAddCrop(e: FormEvent) {
    e.preventDefault()
    setNewCropError(null)
    if (!newCropName.trim()) {
      setNewCropError('作物名は必須です')
      return
    }
    if (!newCropFamilyId) {
      setNewCropError('科を選択してください')
      return
    }
    setNewCropSaving(true)
    try {
      const crop = await createCrop({
        name: newCropName.trim(),
        crop_family_id: Number(newCropFamilyId),
      })
      onCropCreated(crop)
      setCropId(String(crop.id))
      setNewCropName('')
      setShowNewCropForm(false)
    } catch (err) {
      setNewCropError(err instanceof ApiError ? err.message : '作物の作成に失敗しました')
    } finally {
      setNewCropSaving(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('品種名は必須です')
      return
    }
    if (!cropId) {
      setError('作物を選択してください')
      return
    }

    const cultivationCalendar: CultivationCalendar = {}
    for (const zone of REGION_ORDER) {
      const region = calendar[zone]
      if (!isRegionCalendarEmpty(region)) {
        cultivationCalendar[zone] = {
          sowing: region.sowing?.trim() || undefined,
          transplanting: region.transplanting?.trim() || undefined,
          harvest: region.harvest?.trim() || undefined,
        }
      }
    }
    const hasCalendarData = Object.keys(cultivationCalendar).length > 0

    setSaving(true)
    try {
      const payload = {
        crop_id: Number(cropId),
        name: name.trim(),
        cultivation_calendar: hasCalendarData ? cultivationCalendar : null,
        seedling_days: seedlingDays.trim() ? Number(seedlingDays) : null,
        days_to_harvest: daysToHarvest.trim() ? Number(daysToHarvest) : null,
        plant_spacing_cm: plantSpacingCm.trim() ? Number(plantSpacingCm) : null,
        row_spacing_cm: rowSpacingCm.trim() ? Number(rowSpacingCm) : null,
        mulch_type: mulchType.trim() || null,
        protection_notes: protectionNotes.trim() || null,
        source_image_path: initialVariety?.source_image_path ?? null,
        ai_extracted_data: initialVariety?.ai_extracted_data ?? null,
      }
      const saved = initialVariety
        ? await updateVariety(initialVariety.id, payload)
        : await createVariety(payload)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialVariety) return
    if (!window.confirm(`品種「${initialVariety.name}」を削除しますか？`)) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await deleteVariety(initialVariety.id)
      onDeleted?.(initialVariety.id)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 400
            ? '使用中のため削除できません(この品種で作付け登録があります)'
            : err.message
          : '削除に失敗しました',
      )
      setSaving(false)
    }
  }

  return (
    <form className="entity-form variety-form" onSubmit={handleSubmit}>
      <h3>{isEdit ? '品種を編集' : '品種を追加'}</h3>

      <label>
        作物
        <select value={cropId} onChange={(e) => setCropId(e.target.value)}>
          {crops.length === 0 && <option value="">(作物がありません)</option>}
          {crops.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
            </option>
          ))}
        </select>
      </label>

      {!showNewCropForm ? (
        <button type="button" onClick={() => setShowNewCropForm(true)}>
          + 新しい作物を追加
        </button>
      ) : (
        <div className="entity-form entity-form--compact new-crop-form">
          <label>
            作物名
            <input
              value={newCropName}
              onChange={(e) => setNewCropName(e.target.value)}
              placeholder="例: キュウリ"
            />
          </label>
          <label>
            科(CropFamily)
            <select value={newCropFamilyId} onChange={(e) => setNewCropFamilyId(e.target.value)}>
              {cropFamilies.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}(輪作{family.rotation_interval_years}年)
                </option>
              ))}
            </select>
          </label>
          {newCropError && <p className="form-error">{newCropError}</p>}
          <div className="form-actions">
            <button type="button" onClick={handleAddCrop} disabled={newCropSaving}>
              {newCropSaving ? '作成中...' : '作物を作成'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewCropForm(false)
                setNewCropError(null)
              }}
              disabled={newCropSaving}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <label>
        品種名
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 桃太郎" />
      </label>

      <fieldset className="calendar-fieldset">
        <legend>栽培暦(地域帯別)</legend>
        <div className="calendar-tabs">
          {REGION_ORDER.map((zone) => (
            <button
              key={zone}
              type="button"
              className={`calendar-tab${activeZone === zone ? ' calendar-tab--active' : ''}${
                zone === defaultClimateZone ? ' calendar-tab--mine' : ''
              }`}
              onClick={() => setActiveZone(zone)}
            >
              {CLIMATE_ZONE_LABELS[zone]}
              {zone === defaultClimateZone ? '(あなたの地域)' : ''}
            </button>
          ))}
        </div>
        <div className="calendar-tab-body">
          <label>
            種蒔き時期
            <input
              value={calendar[activeZone].sowing ?? ''}
              onChange={(e) => updateRegionField(activeZone, 'sowing', e.target.value)}
              placeholder="例: 3月上旬〜4月上旬"
            />
          </label>
          <label>
            植え付け時期
            <input
              value={calendar[activeZone].transplanting ?? ''}
              onChange={(e) => updateRegionField(activeZone, 'transplanting', e.target.value)}
              placeholder="例: 4月下旬〜5月中旬"
            />
          </label>
          <label>
            収穫時期
            <input
              value={calendar[activeZone].harvest ?? ''}
              onChange={(e) => updateRegionField(activeZone, 'harvest', e.target.value)}
              placeholder="例: 7月上旬〜8月下旬"
            />
          </label>
        </div>
      </fieldset>

      <label>
        育苗日数(日, 任意)
        <input
          type="number"
          step="1"
          min="0"
          value={seedlingDays}
          onChange={(e) => setSeedlingDays(e.target.value)}
        />
      </label>

      <label>
        収穫までの日数目安(日, 任意)
        <input
          type="number"
          step="1"
          min="0"
          value={daysToHarvest}
          onChange={(e) => setDaysToHarvest(e.target.value)}
        />
      </label>

      <label>
        株間(cm, 任意)
        <input
          type="number"
          step="0.1"
          min="0"
          value={plantSpacingCm}
          onChange={(e) => setPlantSpacingCm(e.target.value)}
        />
      </label>

      <label>
        条間(cm, 任意)
        <input
          type="number"
          step="0.1"
          min="0"
          value={rowSpacingCm}
          onChange={(e) => setRowSpacingCm(e.target.value)}
        />
      </label>

      <label>
        マルチング種別(任意)
        <input
          list="mulch-type-suggestions"
          value={mulchType}
          onChange={(e) => setMulchType(e.target.value)}
          placeholder="例: 黒マルチ"
        />
        <datalist id="mulch-type-suggestions">
          {MULCH_TYPE_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </label>

      <label>
        保温・保湿対策メモ(任意)
        <textarea
          rows={3}
          value={protectionNotes}
          onChange={(e) => setProtectionNotes(e.target.value)}
          placeholder="例: 植え付け後2週間はトンネルがけ"
        />
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

export default VarietyForm
