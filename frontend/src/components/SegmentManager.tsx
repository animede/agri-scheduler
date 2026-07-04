import { useState } from 'react'
import type { FormEvent } from 'react'
import { createBedSegment, deleteBedSegment, updateBedSegment } from '../api/bedSegments'
import { ApiError } from '../api/client'
import type { Bed, BedSegment } from '../api/types'

interface SegmentManagerProps {
  bed: Bed
  segments: BedSegment[]
  selectedSegmentId: number | null
  onSelectSegment: (segment: BedSegment) => void
  onChanged: () => void
}

type EditingTarget = 'new' | BedSegment | null

function overlapWarning(
  bed: Bed,
  candidate: { start_offset_m: number; length_m: number },
  others: BedSegment[],
): string | null {
  const start = candidate.start_offset_m
  const end = candidate.start_offset_m + candidate.length_m
  const warnings: string[] = []

  if (candidate.length_m <= 0) {
    warnings.push('区画の長さは正の数値で入力してください')
  }
  if (start < 0 || end > bed.length_m) {
    warnings.push(
      `畝の長さ(${bed.length_m}m)を超えています(区画範囲: ${start}〜${end}m)`,
    )
  }
  for (const other of others) {
    const otherStart = other.start_offset_m
    const otherEnd = other.start_offset_m + other.length_m
    if (start < otherEnd && otherStart < end) {
      warnings.push(`区画「${other.name ?? `#${other.id}`}」と範囲が重なっています`)
    }
  }
  return warnings.length > 0 ? warnings.join(' / ') : null
}

function SegmentForm({
  bed,
  segments,
  initial,
  onSaved,
  onCancel,
}: {
  bed: Bed
  segments: BedSegment[]
  initial: BedSegment | null
  onSaved: (segment: BedSegment) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [startOffsetM, setStartOffsetM] = useState(String(initial?.start_offset_m ?? '0'))
  const [lengthM, setLengthM] = useState(String(initial?.length_m ?? bed.length_m))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const others = segments.filter((s) => s.id !== initial?.id)
  const candidate = { start_offset_m: Number(startOffsetM), length_m: Number(lengthM) }
  const warning = overlapWarning(bed, candidate, others)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!(candidate.length_m > 0)) {
      setError('区画の長さは正の数値で入力してください')
      return
    }
    setSaving(true)
    try {
      const payload = {
        bed_id: bed.id,
        name: name.trim() || null,
        start_offset_m: candidate.start_offset_m,
        length_m: candidate.length_m,
      }
      const saved = initial
        ? await updateBedSegment(initial.id, payload)
        : await createBedSegment(payload)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="entity-form entity-form--compact" onSubmit={handleSubmit}>
      <label>
        区画名(任意)
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 区画1" />
      </label>
      <label>
        開始位置(m)
        <input
          type="number"
          step="0.1"
          value={startOffsetM}
          onChange={(e) => setStartOffsetM(e.target.value)}
        />
      </label>
      <label>
        長さ(m)
        <input type="number" step="0.1" value={lengthM} onChange={(e) => setLengthM(e.target.value)} />
      </label>

      {warning && <p className="form-warning">注意: {warning}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          キャンセル
        </button>
      </div>
    </form>
  )
}

function SegmentManager({
  bed,
  segments,
  selectedSegmentId,
  onSelectSegment,
  onChanged,
}: SegmentManagerProps) {
  const [editing, setEditing] = useState<EditingTarget>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(segment: BedSegment) {
    if (!window.confirm(`区画「${segment.name ?? `#${segment.id}`}」を削除しますか？(作付けも削除されます)`)) {
      return
    }
    setDeleteError(null)
    try {
      await deleteBedSegment(segment.id)
      onChanged()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : '削除に失敗しました')
    }
  }

  return (
    <div className="segment-manager">
      <h4>区画一覧</h4>
      {deleteError && <p className="form-error">{deleteError}</p>}

      {segments.length === 0 && <p className="muted">区画はまだありません。</p>}

      <ul className="segment-list">
        {segments
          .slice()
          .sort((a, b) => a.start_offset_m - b.start_offset_m)
          .map((segment) => (
            <li key={segment.id}>
              {editing !== 'new' && editing?.id === segment.id ? (
                <SegmentForm
                  bed={bed}
                  segments={segments}
                  initial={segment}
                  onSaved={() => {
                    setEditing(null)
                    onChanged()
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div
                  className={`segment-row${segment.id === selectedSegmentId ? ' segment-row--selected' : ''}`}
                  onClick={() => onSelectSegment(segment)}
                >
                  <span>
                    {segment.name ?? `区画#${segment.id}`}: {segment.start_offset_m}m 〜{' '}
                    {segment.start_offset_m + segment.length_m}m (長さ{segment.length_m}m)
                  </span>
                  <span className="segment-row-actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(segment)
                      }}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(segment)
                      }}
                    >
                      削除
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
      </ul>

      {editing === 'new' ? (
        <SegmentForm
          bed={bed}
          segments={segments}
          initial={null}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" onClick={() => setEditing('new')}>
          + 区画を追加
        </button>
      )}
    </div>
  )
}

export default SegmentManager
