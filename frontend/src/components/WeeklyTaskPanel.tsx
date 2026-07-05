import type { WeeklyTaskItem } from '../utils/weeklyTasks'
import './WeeklyTaskPanel.css'

interface WeeklyTaskPanelProps {
  items: WeeklyTaskItem[]
  onSelectSegment: (segmentId: number) => void
}

// 「今週の推奨作業」パネル(圃場マップ/栽培カレンダー両モード共通のヘッダー付近に表示)。
// 各項目をクリックすると該当区画を選択状態にする(spec.md 4.8, implementation-plan.md フェーズ7)。
function WeeklyTaskPanel({ items, onSelectSegment }: WeeklyTaskPanelProps) {
  return (
    <section className="weekly-task-panel">
      <h3>今週の推奨作業</h3>
      {items.length === 0 ? (
        <p className="muted">今日から7日以内の予定・期限超過の作業はありません。</p>
      ) : (
        <ul className="weekly-task-list">
          {items.map((item) => (
            <li key={item.task.id}>
              <button
                type="button"
                className={`weekly-task-item${item.overdue ? ' weekly-task-item--overdue' : ''}`}
                onClick={() => onSelectSegment(item.segment.id)}
              >
                <span className="weekly-task-date">
                  {item.overdue ? '期限超過 ' : ''}
                  {item.task.planned_date_start}
                </span>
                <span className="weekly-task-main">
                  {item.bedName} / {item.segment.name ?? `区画#${item.segment.id}`} —{' '}
                  {item.varietyName} / {item.task.task_type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default WeeklyTaskPanel
