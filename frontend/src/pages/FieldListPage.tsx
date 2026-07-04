import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createField, deleteField, listFields } from '../api/fields'
import { ApiError } from '../api/client'
import type { Field } from '../api/types'
import './FieldListPage.css'

function FieldListPage() {
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [locationNote, setLocationNote] = useState('')
  const [areaSqm, setAreaSqm] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setFields(await listFields())
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('圃場名は必須です')
      return
    }
    setSaving(true)
    try {
      await createField({
        name: name.trim(),
        location_note: locationNote.trim() || null,
        area_sqm: areaSqm.trim() ? Number(areaSqm) : null,
      })
      setName('')
      setLocationNote('')
      setAreaSqm('')
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(field: Field) {
    if (!window.confirm(`圃場「${field.name}」を削除しますか？(畝・区画・作付けも削除されます)`)) {
      return
    }
    setRowError(null)
    try {
      await deleteField(field.id)
      await reload()
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : '削除に失敗しました')
    }
  }

  return (
    <main className="field-list-page">
      <h1>圃場一覧</h1>

      <form className="entity-form" onSubmit={handleSubmit}>
        <h3>新規圃場を追加</h3>
        <label>
          圃場名
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 第一圃場" />
        </label>
        <label>
          場所メモ(任意)
          <input
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            placeholder="例: 自宅裏"
          />
        </label>
        <label>
          面積(㎡, 任意)
          <input
            type="number"
            step="0.1"
            value={areaSqm}
            onChange={(e) => setAreaSqm(e.target.value)}
          />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? '作成中...' : '圃場を追加'}
          </button>
        </div>
      </form>

      {rowError && <p className="form-error">{rowError}</p>}

      {loading && <p>読み込み中...</p>}
      {loadError && <p className="form-error">{loadError}</p>}

      {!loading && !loadError && fields.length === 0 && (
        <p className="muted">まだ圃場が登録されていません。上のフォームから追加してください。</p>
      )}

      <ul className="field-card-list">
        {fields.map((field) => (
          <li key={field.id} className="field-card">
            <Link to={`/fields/${field.id}`} className="field-card-link">
              <h2>{field.name}</h2>
              <p className="muted">{field.location_note ?? '場所メモなし'}</p>
              <p className="muted">{field.area_sqm != null ? `${field.area_sqm}㎡` : '面積未設定'}</p>
            </Link>
            <button type="button" className="danger-button" onClick={() => void handleDelete(field)}>
              削除
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default FieldListPage
