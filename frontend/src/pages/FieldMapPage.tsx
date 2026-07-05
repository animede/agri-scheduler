import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getField } from '../api/fields'
import { listBeds } from '../api/beds'
import { listBedSegments } from '../api/bedSegments'
import { listPlantings } from '../api/plantings'
import { listVarieties } from '../api/varieties'
import { listCrops } from '../api/crops'
import { listCropFamilies } from '../api/cropFamilies'
import { listTasks } from '../api/tasks'
import { ApiError } from '../api/client'
import type { Bed, BedSegment, Crop, CropFamily, Field, Planting, Task, Variety } from '../api/types'
import BedMap from '../components/BedMap'
import BedForm from '../components/BedForm'
import SegmentManager from '../components/SegmentManager'
import SegmentDetailPanel from '../components/SegmentDetailPanel'
import SeasonWheel from '../components/SeasonWheel'
import type { SeasonWheelRingData } from '../components/SeasonWheel'
import WeeklyTaskPanel from '../components/WeeklyTaskPanel'
import RolloverReviewModal from '../components/RolloverReviewModal'
import { pickCurrentPlanting } from '../utils/planting'
import { resolveVariety } from '../utils/resolve'
import { colorForCropFamily } from '../utils/cropFamilyColor'
import { checkCurrentRotationRisk } from '../utils/rotation'
import type { RotationCheckResult } from '../utils/rotation'
import { buildWeeklyTasks } from '../utils/weeklyTasks'
import { buildRolloverPlan } from '../utils/rollover'
import './FieldMapPage.css'

const CURRENT_YEAR = new Date().getFullYear()

type ViewMode = 'map' | 'calendar'

function FieldMapPage() {
  const { fieldId: fieldIdParam } = useParams<{ fieldId: string }>()
  const fieldId = Number(fieldIdParam)

  const [field, setField] = useState<Field | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [segments, setSegments] = useState<BedSegment[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [varieties, setVarieties] = useState<Variety[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [cropFamilies, setCropFamilies] = useState<CropFamily[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadError, setReloadError] = useState<string | null>(null)

  const [creatingBed, setCreatingBed] = useState(false)
  const [editingBedId, setEditingBedId] = useState<number | null>(null)
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null)
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null)

  // フェーズ7: 圃場マップ⇔栽培カレンダーの表示切り替えと、カレンダーの対象年。
  // 選択状態(selectedBedId/selectedSegmentId)は両モードで共有するため、モード切替や
  // 年切替をしてもリセットしない。
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)

  // フェーズ8: 「次年度にロール」レビューモーダルの開閉状態。
  const [showRolloverModal, setShowRolloverModal] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [
        fieldData,
        bedsData,
        segmentsData,
        plantingsData,
        tasksData,
        varietiesData,
        cropsData,
        cropFamiliesData,
      ] = await Promise.all([
        getField(fieldId),
        listBeds(),
        listBedSegments(),
        listPlantings(),
        listTasks(),
        listVarieties(),
        listCrops(),
        listCropFamilies(),
      ])
      setField(fieldData)
      setBeds(bedsData)
      setSegments(segmentsData)
      setPlantings(plantingsData)
      setTasks(tasksData)
      setVarieties(varietiesData)
      setCrops(cropsData)
      setCropFamilies(cropFamiliesData)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [fieldId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // 畝/区画/作付け/タスクの変更後の再読み込み(マスタ3種は変わらない前提で対象を絞る)
  const reloadMapData = useCallback(async () => {
    setReloadError(null)
    try {
      const [bedsData, segmentsData, plantingsData, tasksData] = await Promise.all([
        listBeds(),
        listBedSegments(),
        listPlantings(),
        listTasks(),
      ])
      setBeds(bedsData)
      setSegments(segmentsData)
      setPlantings(plantingsData)
      setTasks(tasksData)
    } catch (err) {
      setReloadError(err instanceof ApiError ? err.message : '再読み込みに失敗しました')
    }
  }, [])

  const fieldBeds = useMemo(() => beds.filter((b) => b.field_id === fieldId), [beds, fieldId])
  const fieldBedIds = useMemo(() => new Set(fieldBeds.map((b) => b.id)), [fieldBeds])

  const segmentsByBed = useMemo(() => {
    const map = new Map<number, BedSegment[]>()
    for (const seg of segments) {
      if (!fieldBedIds.has(seg.bed_id)) continue
      const list = map.get(seg.bed_id) ?? []
      list.push(seg)
      map.set(seg.bed_id, list)
    }
    return map
  }, [segments, fieldBedIds])

  const plantingsBySegment = useMemo(() => {
    const map = new Map<number, Planting[]>()
    for (const p of plantings) {
      const list = map.get(p.bed_segment_id) ?? []
      list.push(p)
      map.set(p.bed_segment_id, list)
    }
    return map
  }, [plantings])

  const lookups = useMemo(
    () => ({
      varietyById: new Map(varieties.map((v) => [v.id, v])),
      cropById: new Map(crops.map((c) => [c.id, c])),
      cropFamilyById: new Map(cropFamilies.map((f) => [f.id, f])),
    }),
    [varieties, crops, cropFamilies],
  )

  const bedById = useMemo(() => new Map(fieldBeds.map((b) => [b.id, b])), [fieldBeds])

  // この圃場に属する区画を「畝の並び順→畝内の開始位置順」で一列に並べたもの。
  // 栽培カレンダー(SeasonWheel)で内側から外側へのリング割り当て順として使う。
  const fieldSegmentsOrdered = useMemo(() => {
    const result: BedSegment[] = []
    for (const bed of fieldBeds) {
      const segs = (segmentsByBed.get(bed.id) ?? []).slice().sort((a, b) => a.start_offset_m - b.start_offset_m)
      result.push(...segs)
    }
    return result
  }, [fieldBeds, segmentsByBed])

  const segmentById = useMemo(
    () => new Map(fieldSegmentsOrdered.map((s) => [s.id, s])),
    [fieldSegmentsOrdered],
  )

  // フィールド内の全Planting(年を問わない。今週の推奨作業サマリで使用)
  const fieldPlantings = useMemo(
    () => plantings.filter((p) => segmentById.has(p.bed_segment_id)),
    [plantings, segmentById],
  )
  const plantingById = useMemo(() => new Map(fieldPlantings.map((p) => [p.id, p])), [fieldPlantings])

  // フィールド内の全Plantingに紐づくTaskのみ抽出する。バックエンドはplanting_idでの
  // クエリフィルタを提供していないため、全件取得してクライアント側で絞り込む
  // (SegmentDetailPanel.tsxの実装と対になる)。
  const fieldTasks = useMemo(
    () => tasks.filter((t) => plantingById.has(t.planting_id)),
    [tasks, plantingById],
  )

  const tasksByPlanting = useMemo(() => {
    const map = new Map<number, Task[]>()
    for (const t of fieldTasks) {
      const list = map.get(t.planting_id) ?? []
      list.push(t)
      map.set(t.planting_id, list)
    }
    return map
  }, [fieldTasks])

  // 栽培カレンダー(SeasonWheel)のリング1本 = 区画1個。選択年のPlantingが無くても
  // 区画自体は常にリングとして表示する(spec.md 4.6 / implementation-plan.md フェーズ7)。
  const seasonWheelRings = useMemo<SeasonWheelRingData[]>(
    () =>
      fieldSegmentsOrdered.map((segment) => ({
        segment,
        bedName: bedById.get(segment.bed_id)?.name ?? `畝#${segment.bed_id}`,
        plantings: (plantingsBySegment.get(segment.id) ?? []).filter((p) => p.year === selectedYear),
      })),
    [fieldSegmentsOrdered, bedById, plantingsBySegment, selectedYear],
  )

  // 「今週の推奨作業」サマリ(圃場マップ・栽培カレンダー両モード共通のヘッダー付近に表示)。
  const weeklyTaskItems = useMemo(
    () => buildWeeklyTasks(fieldTasks, plantingById, segmentById, bedById, lookups),
    [fieldTasks, plantingById, segmentById, bedById, lookups],
  )

  const bedNameForSegment = useCallback(
    (segment: BedSegment) => bedById.get(segment.bed_id)?.name ?? `畝#${segment.bed_id}`,
    [bedById],
  )

  // フェーズ8: 「次年度にロール」のレビュー対象一覧。selectedYearに作付けがある区画のみを対象とする。
  const rolloverRows = useMemo(
    () => buildRolloverPlan(fieldSegmentsOrdered, plantingsBySegment, varieties, lookups, selectedYear),
    [fieldSegmentsOrdered, plantingsBySegment, varieties, lookups, selectedYear],
  )

  const getSegmentColor = useCallback(
    (segment: BedSegment): string | null => {
      const segPlantings = plantingsBySegment.get(segment.id) ?? []
      const current = pickCurrentPlanting(segPlantings, CURRENT_YEAR)
      if (!current) return null
      const { cropFamily } = resolveVariety(current.variety_id, lookups)
      if (!cropFamily) return null
      return colorForCropFamily(cropFamily.name)
    },
    [plantingsBySegment, lookups],
  )

  // 区画の「現在の作付け」が、それより前の作付け履歴と輪作年限に抵触していないかを判定する
  // (圃場マップ上の警告アイコン表示用)。
  const getSegmentRotationRisk = useCallback(
    (segment: BedSegment): RotationCheckResult => {
      const segPlantings = plantingsBySegment.get(segment.id) ?? []
      const current = pickCurrentPlanting(segPlantings, CURRENT_YEAR)
      if (!current) return { warning: false }
      return checkCurrentRotationRisk(segPlantings, current, lookups)
    },
    [plantingsBySegment, lookups],
  )

  const selectedBed = fieldBeds.find((b) => b.id === selectedBedId) ?? null
  const selectedBedSegments = selectedBed ? segmentsByBed.get(selectedBed.id) ?? [] : []
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) ?? null
  const selectedSegmentPlantings = selectedSegment
    ? plantingsBySegment.get(selectedSegment.id) ?? []
    : []

  function handleSelectBed(bedId: number) {
    setSelectedBedId(bedId)
    setSelectedSegmentId(null)
  }

  function handleSelectSegment(segment: BedSegment) {
    setSelectedBedId(segment.bed_id)
    setSelectedSegmentId(segment.id)
  }

  // SeasonWheelの円弧クリック/今週の推奨作業パネルのクリックは区画IDのみを渡してくるため、
  // 対応するBedSegmentを引いてhandleSelectSegmentに委譲する(圃場マップとの双方向連動)。
  function handleSelectSegmentId(segmentId: number) {
    const segment = segmentById.get(segmentId)
    if (segment) handleSelectSegment(segment)
  }

  if (loading) {
    return (
      <main className="field-map-page">
        <p>読み込み中...</p>
      </main>
    )
  }

  if (loadError || !field) {
    return (
      <main className="field-map-page">
        <p className="form-error">
          {loadError ?? '圃場が見つかりませんでした'}
        </p>
        <Link to="/">圃場一覧に戻る</Link>
      </main>
    )
  }

  return (
    <main className="field-map-page">
      <div className="field-map-header">
        <Link to="/">← 圃場一覧</Link>
        <h1>{field.name}</h1>
        <p className="muted">
          {field.location_note ?? '場所メモなし'}
          {field.area_sqm != null ? ` / ${field.area_sqm}㎡` : ''}
        </p>

        <div className="view-mode-toggle" role="tablist" aria-label="表示モード">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'map'}
            className={`view-mode-tab${viewMode === 'map' ? ' view-mode-tab--active' : ''}`}
            onClick={() => setViewMode('map')}
          >
            🗺 圃場マップ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'calendar'}
            className={`view-mode-tab${viewMode === 'calendar' ? ' view-mode-tab--active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            📅 栽培カレンダー
          </button>
        </div>

        {viewMode === 'calendar' && (
          <div className="year-selector">
            <button type="button" onClick={() => setSelectedYear((y) => y - 1)} aria-label="前年">
              ← 前年
            </button>
            <span className="year-selector-label">{selectedYear}年</span>
            <button type="button" onClick={() => setSelectedYear((y) => y + 1)} aria-label="翌年">
              翌年 →
            </button>
            {selectedYear !== CURRENT_YEAR && (
              <button type="button" onClick={() => setSelectedYear(CURRENT_YEAR)}>
                今年に戻る
              </button>
            )}
            <button type="button" onClick={() => setShowRolloverModal(true)}>
              次年度にロール
            </button>
          </div>
        )}
      </div>

      <WeeklyTaskPanel items={weeklyTaskItems} onSelectSegment={handleSelectSegmentId} />

      {reloadError && <p className="form-error">{reloadError}</p>}

      <div className="field-map-layout">
        <div className="field-map-main">
          {viewMode === 'map' ? (
            <>
              <BedMap
                beds={fieldBeds}
                segmentsByBed={segmentsByBed}
                getSegmentColor={getSegmentColor}
                getSegmentRotationRisk={getSegmentRotationRisk}
                selectedBedId={selectedBedId}
                selectedSegmentId={selectedSegmentId}
                onSelectBed={handleSelectBed}
                onSelectSegment={handleSelectSegment}
              />
              <p className="muted map-legend-note">
                色は「現在の作付け」の作物の科(CropFamily)ごとに自動で割り当てられます。グレーは空き区画です。
              </p>
            </>
          ) : (
            <>
              <SeasonWheel
                rings={seasonWheelRings}
                year={selectedYear}
                tasksByPlanting={tasksByPlanting}
                lookups={lookups}
                selectedSegmentId={selectedSegmentId}
                onSelectSegment={handleSelectSegmentId}
              />
              <p className="muted map-legend-note">
                内側から外側へ区画ごとに1本のリング。円弧は各作付けの推定作業期間(種蒔き〜収穫)を表し、
                色は圃場マップと同じ科(CropFamily)ごとの色分けです。🌱種蒔き / 🌿植え付け / 🌾収穫。
              </p>
            </>
          )}
        </div>

        <aside className="map-sidebar">
          {!creatingBed && (
            <button type="button" onClick={() => setCreatingBed(true)}>
              + 畝を追加
            </button>
          )}
          {creatingBed && (
            <BedForm
              fieldId={fieldId}
              onSaved={(bed) => {
                setCreatingBed(false)
                setSelectedBedId(bed.id)
                setSelectedSegmentId(null)
                void reloadMapData()
              }}
              onCancel={() => setCreatingBed(false)}
            />
          )}

          {selectedBed && (
            <div className="selected-bed-panel">
              <div className="panel-header">
                <h3>{selectedBed.name}</h3>
                <div className="panel-header-actions">
                  {editingBedId !== selectedBed.id && (
                    <button type="button" onClick={() => setEditingBedId(selectedBed.id)}>
                      編集
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBedId(null)
                      setSelectedSegmentId(null)
                      setEditingBedId(null)
                    }}
                  >
                    選択解除
                  </button>
                </div>
              </div>
              <p className="muted">
                長さ{selectedBed.length_m}m / 幅{selectedBed.width_cm}cm / 向き:{' '}
                {selectedBed.orientation === 'vertical' ? 'vertical(縦)' : 'horizontal(横)'} / 座標(
                {selectedBed.pos_x}, {selectedBed.pos_y})
              </p>

              {editingBedId === selectedBed.id && (
                <BedForm
                  fieldId={fieldId}
                  initialBed={selectedBed}
                  onSaved={() => {
                    setEditingBedId(null)
                    void reloadMapData()
                  }}
                  onCancel={() => setEditingBedId(null)}
                  onDeleted={() => {
                    setEditingBedId(null)
                    setSelectedBedId(null)
                    setSelectedSegmentId(null)
                    void reloadMapData()
                  }}
                />
              )}

              <SegmentManager
                bed={selectedBed}
                segments={selectedBedSegments}
                selectedSegmentId={selectedSegmentId}
                onSelectSegment={(segment) => setSelectedSegmentId(segment.id)}
                onChanged={() => void reloadMapData()}
              />
            </div>
          )}

          {selectedSegment && (
            <SegmentDetailPanel
              segment={selectedSegment}
              plantings={selectedSegmentPlantings}
              varieties={varieties}
              lookups={lookups}
              currentYear={CURRENT_YEAR}
              onClose={() => setSelectedSegmentId(null)}
              onChanged={() => void reloadMapData()}
              readOnly={selectedYear < CURRENT_YEAR}
            />
          )}

          {!selectedBed && !creatingBed && (
            <p className="muted">
              マップ上の畝をクリックして選択するか、「+ 畝を追加」から新規作成してください。
            </p>
          )}
        </aside>
      </div>

      {showRolloverModal && (
        <RolloverReviewModal
          rows={rolloverRows}
          year={selectedYear}
          plantingsBySegment={plantingsBySegment}
          varieties={varieties}
          lookups={lookups}
          bedNameFor={bedNameForSegment}
          onClose={() => setShowRolloverModal(false)}
          onCreated={() => void reloadMapData()}
          onAllDone={(nextYear) => {
            setSelectedYear(nextYear)
            setShowRolloverModal(false)
          }}
        />
      )}
    </main>
  )
}

export default FieldMapPage
