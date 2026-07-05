import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getField } from '../api/fields'
import { listBeds } from '../api/beds'
import { listBedSegments } from '../api/bedSegments'
import { listPlantings } from '../api/plantings'
import { listVarieties } from '../api/varieties'
import { listCrops } from '../api/crops'
import { listCropFamilies } from '../api/cropFamilies'
import { ApiError } from '../api/client'
import type { Bed, BedSegment, Crop, CropFamily, Field, Planting, Variety } from '../api/types'
import BedMap from '../components/BedMap'
import BedForm from '../components/BedForm'
import SegmentManager from '../components/SegmentManager'
import SegmentDetailPanel from '../components/SegmentDetailPanel'
import { pickCurrentPlanting } from '../utils/planting'
import { resolveVariety } from '../utils/resolve'
import { colorForCropFamily } from '../utils/cropFamilyColor'
import { checkCurrentRotationRisk } from '../utils/rotation'
import type { RotationCheckResult } from '../utils/rotation'
import './FieldMapPage.css'

const CURRENT_YEAR = new Date().getFullYear()

function FieldMapPage() {
  const { fieldId: fieldIdParam } = useParams<{ fieldId: string }>()
  const fieldId = Number(fieldIdParam)

  const [field, setField] = useState<Field | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [segments, setSegments] = useState<BedSegment[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
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

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [fieldData, bedsData, segmentsData, plantingsData, varietiesData, cropsData, cropFamiliesData] =
        await Promise.all([
          getField(fieldId),
          listBeds(),
          listBedSegments(),
          listPlantings(),
          listVarieties(),
          listCrops(),
          listCropFamilies(),
        ])
      setField(fieldData)
      setBeds(bedsData)
      setSegments(segmentsData)
      setPlantings(plantingsData)
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

  // 畝/区画/作付けの変更後の再読み込み(マスタ3種は変わらない前提で対象を絞る)
  const reloadMapData = useCallback(async () => {
    setReloadError(null)
    try {
      const [bedsData, segmentsData, plantingsData] = await Promise.all([
        listBeds(),
        listBedSegments(),
        listPlantings(),
      ])
      setBeds(bedsData)
      setSegments(segmentsData)
      setPlantings(plantingsData)
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
      </div>

      {reloadError && <p className="form-error">{reloadError}</p>}

      <div className="field-map-layout">
        <div className="field-map-main">
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
            />
          )}

          {!selectedBed && !creatingBed && (
            <p className="muted">
              マップ上の畝をクリックして選択するか、「+ 畝を追加」から新規作成してください。
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}

export default FieldMapPage
