import { useState } from 'react'
import type { FormEvent } from 'react'
import { createTask, deleteTask, updateTask } from '../api/tasks'
import { ApiError } from '../api/client'
import type { ClimateZone, Planting, Task, Variety } from '../api/types'
import { generateTasks } from '../utils/taskTemplate'

interface PlantingTaskSectionProps {
  planting: Planting
  variety: Variety | undefined
  tasks: Task[]
  climateZone: ClimateZone
  // タスクの追加/更新/削除/再計算のいずれかが成功した後に呼ばれる。
  // 呼び出し側(SegmentDetailPanel)でタスク一覧の再読み込みを行う想定。
  onTasksChanged: () => void
}

// 日付なし(null)は末尾に回して、planned_date_start昇順で並べる(未定タスクは下に表示)。
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.planned_date_start === b.planned_date_start) return a.id - b.id
    if (!a.planned_date_start) return 1
    if (!b.planned_date_start) return -1
    return a.planned_date_start.localeCompare(b.planned_date_start)
  })
}

function PlantingTaskSection({
  planting,
  variety,
  tasks,
  climateZone,
  onTasksChanged,
}: PlantingTaskSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newTaskType, setNewTaskType] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const completedCount = tasks.filter((t) => t.is_completed).length

  async function toggleCompleted(task: Task) {
    setError(null)
    setBusyTaskId(task.id)
    try {
      await updateTask(task.id, { is_completed: !task.is_completed })
      onTasksChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新に失敗しました')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function updateActualDate(task: Task, value: string) {
    setError(null)
    setBusyTaskId(task.id)
    try {
      await updateTask(task.id, { actual_date: value || null })
      onTasksChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新に失敗しました')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function updateNotes(task: Task, value: string) {
    if (value === (task.notes ?? '')) return
    setError(null)
    setBusyTaskId(task.id)
    try {
      await updateTask(task.id, { notes: value || null })
      onTasksChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新に失敗しました')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function handleDelete(task: Task) {
    if (!window.confirm(`タスク「${task.task_type}」を削除しますか？`)) return
    setError(null)
    setBusyTaskId(task.id)
    try {
      await deleteTask(task.id)
      onTasksChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function handleAddCustomTask(e: FormEvent) {
    e.preventDefault()
    if (!newTaskType.trim()) {
      setError('タスク名を入力してください')
      return
    }
    setError(null)
    setAdding(true)
    try {
      await createTask({
        planting_id: planting.id,
        task_type: newTaskType.trim(),
        planned_date_start: newStart || null,
        planned_date_end: newEnd || null,
        actual_date: null,
        is_completed: false,
        notes: newNotes.trim() || null,
      })
      setNewTaskType('')
      setNewStart('')
      setNewEnd('')
      setNewNotes('')
      setShowAddForm(false)
      onTasksChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  // 「作業タスクを再計算」: 現在のPlanting/Variety/気候帯からテンプレートを再導出し、
  // 未完了かつテンプレートに同名(task_type)のタスクが既存であれば、その予定日のみを
  // 新しい値で上書きする。完了済みタスクやテンプレートに無いカスタムタスクには触れない。
  async function handleRecalculate() {
    if (!variety) return
    setError(null)
    setRecalculating(true)
    try {
      const drafts = generateTasks(planting, variety, climateZone)
      const draftByType = new Map(drafts.map((d) => [d.task_type, d]))
      const targets = tasks.filter((t) => !t.is_completed && draftByType.has(t.task_type))
      await Promise.all(
        targets.map((t) => {
          const d = draftByType.get(t.task_type)
          if (!d) return Promise.resolve()
          return updateTask(t.id, {
            planned_date_start: d.planned_date_start,
            planned_date_end: d.planned_date_end,
          })
        }),
      )
      onTasksChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '再計算に失敗しました')
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="task-section">
      <button
        type="button"
        className="task-section-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? '▼' : '▶'} 作業タスク({completedCount}/{tasks.length}完了)
      </button>

      {expanded && (
        <div className="task-section-body">
          {error && <p className="form-error">{error}</p>}

          {tasks.length === 0 ? (
            <p className="muted">タスクがありません。</p>
          ) : (
            <ul className="task-list">
              {sortTasks(tasks).map((task) => (
                <li key={task.id} className={`task-row${task.is_completed ? ' task-row--done' : ''}`}>
                  <label className="task-row-check">
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      disabled={busyTaskId === task.id}
                      onChange={() => void toggleCompleted(task)}
                    />
                    <span className="task-type">{task.task_type}</span>
                  </label>
                  <span className="task-planned-range muted">
                    {task.planned_date_start ?? '未定'}
                    {task.planned_date_end && task.planned_date_end !== task.planned_date_start
                      ? ` 〜 ${task.planned_date_end}`
                      : ''}
                  </span>
                  <label className="task-actual-date">
                    実績日
                    <input
                      type="date"
                      value={task.actual_date ?? ''}
                      disabled={busyTaskId === task.id}
                      onChange={(e) => void updateActualDate(task, e.target.value)}
                    />
                  </label>
                  <input
                    className="task-notes-input"
                    type="text"
                    placeholder="メモ"
                    defaultValue={task.notes ?? ''}
                    disabled={busyTaskId === task.id}
                    onBlur={(e) => void updateNotes(task, e.target.value)}
                  />
                  <button
                    type="button"
                    className="danger-button"
                    disabled={busyTaskId === task.id}
                    onClick={() => void handleDelete(task)}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="task-section-actions">
            <button
              type="button"
              onClick={() => void handleRecalculate()}
              disabled={recalculating || !variety}
              title={
                variety
                  ? '完了していないタスクの予定日を、現在の実績/計画/栽培暦から再計算します'
                  : '品種情報が取得できないため再計算できません'
              }
            >
              {recalculating ? '再計算中...' : '作業タスクを再計算'}
            </button>
            {!showAddForm ? (
              <button type="button" onClick={() => setShowAddForm(true)}>
                ＋タスクを追加
              </button>
            ) : null}
          </div>

          {showAddForm && (
            <form className="entity-form entity-form--compact" onSubmit={handleAddCustomTask}>
              <label>
                タスク名
                <input
                  type="text"
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  placeholder="例: 防除"
                />
              </label>
              <label>
                予定開始日
                <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </label>
              <label>
                予定終了日
                <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </label>
              <label>
                メモ
                <textarea rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={adding}>
                  {adding ? '追加中...' : '追加'}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} disabled={adding}>
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default PlantingTaskSection
