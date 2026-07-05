import { useState } from 'react'
import type { FormEvent } from 'react'
import { analyzeVarietyImage } from '../api/aiAnalysis'
import { createCrop } from '../api/crops'
import { createVariety, deleteVariety, updateVariety } from '../api/varieties'
import { ApiError, buildStaticUrl } from '../api/client'
import type {
  AIExtractedVarietyData,
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

// AI解析結果(反映前)を人間が読める箇条書きに変換する。
// ユーザーが「反映する」を押す前に、何が上書きされるのかを確認できるようにするため。
function summarizeExtracted(extracted: AIExtractedVarietyData): string[] {
  const lines: string[] = []
  const calendar = extracted.cultivation_calendar
  if (calendar) {
    for (const zone of REGION_ORDER) {
      const region = calendar[zone]
      if (!region) continue
      const parts: string[] = []
      if (region.sowing) parts.push(`種蒔き:${region.sowing}`)
      if (region.transplanting) parts.push(`植付:${region.transplanting}`)
      if (region.harvest) parts.push(`収穫:${region.harvest}`)
      if (parts.length > 0) {
        lines.push(`${CLIMATE_ZONE_LABELS[zone]}: ${parts.join(' / ')}`)
      }
    }
  }
  if (extracted.seedling_days != null) lines.push(`育苗日数: ${extracted.seedling_days}日`)
  if (extracted.days_to_harvest != null) {
    lines.push(`収穫までの日数目安: ${extracted.days_to_harvest}日`)
  }
  if (extracted.plant_spacing_cm != null) lines.push(`株間: ${extracted.plant_spacing_cm}cm`)
  if (extracted.row_spacing_cm != null) lines.push(`条間: ${extracted.row_spacing_cm}cm`)
  if (extracted.mulch_type) lines.push(`マルチング種別: ${extracted.mulch_type}`)
  if (extracted.protection_notes) lines.push(`保温・保湿対策メモ: ${extracted.protection_notes}`)
  return lines
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

  // Phase6: AI画像解析(種苗パッケージ画像のアップロード・解析)関連のstate。
  // sourceImagePath/aiExtractedDataは保存時にVariety.source_image_path/ai_extracted_data
  // として送信する。AI解析の抽出結果はaiPreviewに一旦保持し、ユーザーが「反映する」を
  // 押すまでは他のフォームフィールドを書き換えない(spec.md 4.3: 確認ステップの必須化)。
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPreview, setAiPreview] = useState<{
    image_path: string
    extracted: AIExtractedVarietyData
    raw_response: string
  } | null>(null)
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(
    initialVariety?.source_image_path ?? null,
  )
  const [aiExtractedData, setAiExtractedData] = useState<Record<string, unknown> | null>(
    initialVariety?.ai_extracted_data ?? null,
  )
  const [showRawAiData, setShowRawAiData] = useState(false)

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

  async function handleAnalyzeImage() {
    if (!imageFile) return
    setAnalyzing(true)
    setAiError(null)
    setAiPreview(null)
    try {
      const result = await analyzeVarietyImage(imageFile)
      setAiPreview(result)
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        // ANTHROPIC_API_KEY未設定 or ネットワーク未接続時のフォールバック(spec.md 5章)。
        setAiError('AI画像解析は現在利用できません。手動で入力してください。')
      } else if (err instanceof ApiError) {
        setAiError(`AI画像解析は現在利用できません。手動で入力してください。(${err.message})`)
      } else {
        setAiError('AI画像解析は現在利用できません。手動で入力してください。')
      }
    } finally {
      setAnalyzing(false)
    }
  }

  // AI解析結果をフォームの各フィールドに反映する。反映後も通常のフォーム入力として
  // 編集可能なままなので、保存前にユーザーが確認・修正できる(spec.md 4.3)。
  function handleApplyAiPreview() {
    if (!aiPreview) return
    const extracted = aiPreview.extracted

    if (extracted.cultivation_calendar) {
      setCalendar((prev) => {
        const next = { ...prev }
        for (const zone of REGION_ORDER) {
          const region = extracted.cultivation_calendar?.[zone]
          if (region) {
            next[zone] = {
              sowing: region.sowing ?? prev[zone].sowing,
              transplanting: region.transplanting ?? prev[zone].transplanting,
              harvest: region.harvest ?? prev[zone].harvest,
            }
          }
        }
        return next
      })
    }
    if (extracted.seedling_days != null) setSeedlingDays(String(extracted.seedling_days))
    if (extracted.days_to_harvest != null) setDaysToHarvest(String(extracted.days_to_harvest))
    if (extracted.plant_spacing_cm != null) setPlantSpacingCm(String(extracted.plant_spacing_cm))
    if (extracted.row_spacing_cm != null) setRowSpacingCm(String(extracted.row_spacing_cm))
    if (extracted.mulch_type) setMulchType(extracted.mulch_type)
    if (extracted.protection_notes) setProtectionNotes(extracted.protection_notes)

    setSourceImagePath(aiPreview.image_path)
    setAiExtractedData({ extracted: aiPreview.extracted, raw_response: aiPreview.raw_response })
    setAiPreview(null)
    setImageFile(null)
  }

  function handleDiscardAiPreview() {
    setAiPreview(null)
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
        source_image_path: sourceImagePath,
        ai_extracted_data: aiExtractedData,
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

      <fieldset className="ai-image-fieldset">
        <legend>種苗パッケージ画像からAI解析(任意)</legend>

        {sourceImagePath && !aiPreview && (
          <div className="variety-image-preview">
            <img
              src={buildStaticUrl(sourceImagePath)}
              alt="登録済みの種苗パッケージ画像"
              className="variety-image-thumb"
            />
            <span className="muted">登録済みの画像</span>
          </div>
        )}

        <label className="ai-image-file-label">
          画像ファイルを選択
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setImageFile(e.target.files?.[0] ?? null)
              setAiError(null)
            }}
          />
        </label>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => void handleAnalyzeImage()}
            disabled={!imageFile || analyzing}
          >
            {analyzing ? 'AI解析中...' : 'AIで解析'}
          </button>
        </div>

        {aiError && <p className="form-error">{aiError}</p>}

        {aiPreview && (
          <div className="ai-preview-panel">
            <p>
              AI解析結果をフォームに反映しますか？(既存の入力は上書きされます。反映後も保存前に
              各項目を確認・修正できます)
            </p>
            <ul className="ai-preview-summary">
              {summarizeExtracted(aiPreview.extracted).map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
              {summarizeExtracted(aiPreview.extracted).length === 0 && (
                <li className="muted">読み取れた項目がありませんでした</li>
              )}
            </ul>
            <div className="form-actions">
              <button type="button" onClick={handleApplyAiPreview}>
                反映する
              </button>
              <button type="button" onClick={handleDiscardAiPreview}>
                破棄する
              </button>
            </div>
          </div>
        )}

        {aiExtractedData && (
          <div className="ai-raw-data">
            <button type="button" onClick={() => setShowRawAiData((prev) => !prev)}>
              {showRawAiData ? 'AI解析の生データを隠す' : 'AI解析の生データを表示'}
            </button>
            {showRawAiData && (
              <pre className="ai-raw-data-body">{JSON.stringify(aiExtractedData, null, 2)}</pre>
            )}
          </div>
        )}
      </fieldset>

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
