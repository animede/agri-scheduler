import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createField, deleteField, listFields } from '../api/fields'
import { ApiError } from '../api/client'
import type { Field } from '../api/types'
import './FieldListPage.css'

// トップページの「各表示へ直接飛べるボタン」1件分の定義。
// to が null のカードは無効化状態(ボタンではなく非活性の案内)として表示する。
interface ShortcutCard {
  key: string
  emoji: string
  title: string
  description: string
  to: string | null
  disabledHint?: string
}

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

  // ショートカットカードの遷移先は「圃場一覧の並び順の先頭」の圃場を使う(複数圃場が
  // ある場合の選択UIはここでは持たない、spec上シンプルさ優先)。
  const firstField = fields.length > 0 ? fields[0] : null
  const noFieldHint = 'まず圃場を登録してください'

  const shortcutCards: ShortcutCard[] = [
    {
      key: 'map',
      emoji: '🗺',
      title: '圃場マップ',
      description: '畑のレイアウトを見ながら畝・区画を管理',
      to: firstField ? `/fields/${firstField.id}` : null,
      disabledHint: noFieldHint,
    },
    {
      key: 'calendar',
      emoji: '📅',
      title: '栽培カレンダー',
      description: '年間の作付けをタイムラインで俯瞰',
      to: firstField ? `/fields/${firstField.id}?view=calendar` : null,
      disabledHint: noFieldHint,
    },
    {
      key: 'varieties',
      emoji: '🌱',
      title: '品種管理',
      description: '品種の栽培暦・AI画像解析で登録',
      to: '/varieties',
    },
    {
      key: 'settings',
      emoji: '⚙️',
      title: '設定',
      description: '気候帯を設定して栽培暦をあなたの地域向けに',
      to: '/settings',
    },
  ]

  return (
    <main className="field-list-page">
      <section className="field-list-hero">
        <h1>🌾 今日の畑仕事を、ひと目で。</h1>
        <p className="muted">
          圃場のレイアウトから栽培カレンダー、品種の栽培暦まで。下のメニューからすぐに移動できます。
        </p>
      </section>

      <section className="shortcut-card-grid" aria-label="主要画面へのショートカット">
        {shortcutCards.map((card) =>
          card.to ? (
            <Link key={card.key} to={card.to} className="shortcut-card">
              <span className="shortcut-card-icon" aria-hidden="true">
                {card.emoji}
              </span>
              <span className="shortcut-card-title">{card.title}</span>
              <span className="shortcut-card-desc">{card.description}</span>
            </Link>
          ) : (
            <div key={card.key} className="shortcut-card shortcut-card--disabled" aria-disabled="true">
              <span className="shortcut-card-icon" aria-hidden="true">
                {card.emoji}
              </span>
              <span className="shortcut-card-title">{card.title}</span>
              <span className="shortcut-card-desc">{card.disabledHint ?? card.description}</span>
            </div>
          ),
        )}
      </section>

      <section className="field-list-section">
        <h2>🌿 圃場一覧</h2>

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
      </section>
    </main>
  )
}

export default FieldListPage
