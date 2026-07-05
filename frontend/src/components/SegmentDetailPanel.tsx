import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BedSegment, Planting, Task, Variety } from '../api/types'
import { deletePlanting } from '../api/plantings'
import { createTask, listTasks } from '../api/tasks'
import { ApiError } from '../api/client'
import { pickCurrentPlanting, sortHistory } from '../utils/planting'
import { resolveVariety } from '../utils/resolve'
import type { Lookups } from '../utils/resolve'
import { checkCurrentRotationRisk } from '../utils/rotation'
import { generateTasks } from '../utils/taskTemplate'
import { getClimateZone } from '../utils/settings'
import PlantingForm from './PlantingForm'
import PlantingTaskSection from './PlantingTaskSection'

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
  const [taskGenError, setTaskGenError] = useState<string | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksError, setTasksError] = useState<string | null>(null)

  const current = pickCurrentPlanting(plantings, currentYear)
  const history = sortHistory(plantings, current)
  const currentRisk = current
    ? checkCurrentRotationRisk(plantings, current, lookups)
    : ({ warning: false } as const)

  // このPlanting群(=区画)に紐づくタスクのみを保持する。バックエンドにplanting_idでの
  // フィルタが無いため、全件取得してクライアント側で絞り込む(api/tasks.tsの実装と対になる)。
  const plantingIds = useMemo(() => new Set(plantings.map((p) => p.id)), [plantings])

  const loadTasks = useCallback(async () => {
    setTasksError(null)
    try {
      const all = await listTasks()
      setTasks(all.filter((t) => plantingIds.has(t.planting_id)))
    } catch (err) {
      setTasksError(err instanceof ApiError ? err.message : 'タスクの読み込みに失敗しました')
    }
  }, [plantingIds])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  const tasksByPlanting = useMemo(() => {
    const map = new Map<number, Task[]>()
    for (const t of tasks) {
      const list = map.get(t.planting_id) ?? []
      list.push(t)
      map.set(t.planting_id, list)
    }
    return map
  }, [tasks])

  // 作付け保存後の処理。新規作成時のみ、品種の栽培暦・気候帯からタスクを自動生成する
  // (spec.md 4.4/4.8, implementation-plan.md フェーズ5)。編集時は自動生成しない
  // (時期がずれた場合はPlantingTaskSectionの「作業タスクを再計算」で明示的に反映する)。
  async function handlePlantingSaved(saved: Planting) {
    const wasNew = mode.kind === 'new'
    setMode({ kind: 'view' })
    setTaskGenError(null)

    if (wasNew) {
      const variety = lookups.varietyById.get(saved.variety_id)
      if (variety) {
        try {
          const drafts = generateTasks(saved, variety, getClimateZone())
          await Promise.all(
            drafts.map((d) =>
              createTask({
                planting_id: saved.id,
                task_type: d.task_type,
                planned_date_start: d.planned_date_start,
                planned_date_end: d.planned_date_end,
                actual_date: null,
                is_completed: false,
                notes: d.notes ?? null,
              }),
            ),
          )
        } catch (err) {
          setTaskGenError(
            err instanceof ApiError ? err.message : '作業タスクの自動生成に失敗しました',
          )
        }
      }
    }

    onChanged()
    void loadTasks()
  }

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
          onSaved={(saved) => void handlePlantingSaved(saved)}
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
      {taskGenError && <p className="form-error">作業タスクの自動生成: {taskGenError}</p>}
      {tasksError && <p className="form-error">{tasksError}</p>}

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
            <PlantingTaskSection
              planting={current}
              variety={lookups.varietyById.get(current.variety_id)}
              tasks={tasksByPlanting.get(current.id) ?? []}
              climateZone={getClimateZone()}
              onTasksChanged={() => void loadTasks()}
            />
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
                <div className="history-row-main">
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
                </div>
                <PlantingTaskSection
                  planting={p}
                  variety={lookups.varietyById.get(p.variety_id)}
                  tasks={tasksByPlanting.get(p.id) ?? []}
                  climateZone={getClimateZone()}
                  onTasksChanged={() => void loadTasks()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default SegmentDetailPanel
