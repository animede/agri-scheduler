import { useState } from 'react'
import type { FormEvent } from 'react'
import { createBed, deleteBed, updateBed } from '../api/beds'
import { ApiError } from '../api/client'
import type { Bed, BedOrientation } from '../api/types'

interface BedFormProps {
  fieldId: number
  initialBed?: Bed | null
  onSaved: (bed: Bed) => void
  onCancel: () => void
  onDeleted?: (bedId: number) => void
}

function BedForm({ fieldId, initialBed, onSaved, onCancel, onDeleted }: BedFormProps) {
  const isEdit = initialBed != null
  const [name, setName] = useState(initialBed?.name ?? '')
  const [lengthM, setLengthM] = useState(String(initialBed?.length_m ?? '5'))
  const [widthCm, setWidthCm] = useState(String(initialBed?.width_cm ?? '60'))
  const [orientation, setOrientation] = useState<BedOrientation>(
    initialBed?.orientation === 'vertical' ? 'vertical' : 'horizontal',
  )
  const [posX, setPosX] = useState(String(initialBed?.pos_x ?? '0'))
  const [posY, setPosY] = useState(String(initialBed?.pos_y ?? '0'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const lengthValue = Number(lengthM)
    const widthValue = Number(widthCm)
    const posXValue = Number(posX)
    const posYValue = Number(posY)

    if (!name.trim()) {
      setError('畝名は必須です')
      return
    }
    if (!(lengthValue > 0) || !(widthValue > 0)) {
      setError('長さ・幅は正の数値で入力してください')
      return
    }

    setSaving(true)
    try {
      const payload = {
        field_id: fieldId,
        name: name.trim(),
        length_m: lengthValue,
        width_cm: widthValue,
        orientation,
        pos_x: posXValue,
        pos_y: posYValue,
      }
      const saved = initialBed
        ? await updateBed(initialBed.id, payload)
        : await createBed(payload)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialBed) return
    if (!window.confirm(`畝「${initialBed.name}」を削除しますか？(区画・作付けも削除されます)`)) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await deleteBed(initialBed.id)
      onDeleted?.(initialBed.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました')
      setSaving(false)
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <h3>{isEdit ? '畝を編集' : '畝を追加'}</h3>

      <label>
        畝名
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 畝A" />
      </label>

      <label>
        長さ(m)
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={lengthM}
          onChange={(e) => setLengthM(e.target.value)}
        />
      </label>

      <label>
        幅(cm)
        <input
          type="number"
          step="1"
          min="1"
          value={widthCm}
          onChange={(e) => setWidthCm(e.target.value)}
        />
      </label>

      <fieldset className="orientation-fieldset">
        <legend>向き</legend>
        <label className="radio-label">
          <input
            type="radio"
            name="orientation"
            checked={orientation === 'horizontal'}
            onChange={() => setOrientation('horizontal')}
          />
          横向き(horizontal): 長さを左右方向に描画
        </label>
        <label className="radio-label">
          <input
            type="radio"
            name="orientation"
            checked={orientation === 'vertical'}
            onChange={() => setOrientation('vertical')}
          />
          縦向き(vertical): 長さを上下方向に描画
        </label>
      </fieldset>

      <label>
        配置X座標(m, 圃場内の左上からの位置)
        <input type="number" step="0.1" value={posX} onChange={(e) => setPosX(e.target.value)} />
      </label>

      <label>
        配置Y座標(m, 圃場内の左上からの位置)
        <input type="number" step="0.1" value={posY} onChange={(e) => setPosY(e.target.value)} />
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

export default BedForm
