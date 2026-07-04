import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCropFamilies } from '../api/cropFamilies'
import { listCrops } from '../api/crops'
import { listVarieties } from '../api/varieties'
import { ApiError } from '../api/client'
import type { ClimateZone, Crop, CropFamily, RegionCalendar, Variety } from '../api/types'
import VarietyForm from '../components/VarietyForm'
import { CLIMATE_ZONE_LABELS, getClimateZone } from '../utils/settings'
import './VarietyListPage.css'

function regionSummary(region: RegionCalendar | undefined): string | null {
  if (!region) return null
  const parts: string[] = []
  if (region.sowing) parts.push(`種蒔き:${region.sowing}`)
  if (region.transplanting) parts.push(`植付:${region.transplanting}`)
  if (region.harvest) parts.push(`収穫:${region.harvest}`)
  return parts.length > 0 ? parts.join(' / ') : null
}

function VarietyListPage() {
  const [varieties, setVarieties] = useState<Variety[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [cropFamilies, setCropFamilies] = useState<CropFamily[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(null)

  const climateZone: ClimateZone = getClimateZone()

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [varietiesData, cropsData, cropFamiliesData] = await Promise.all([
        listVarieties(),
        listCrops(),
        listCropFamilies(),
      ])
      setVarieties(varietiesData)
      setCrops(cropsData)
      setCropFamilies(cropFamiliesData)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const cropById = useMemo(() => new Map(crops.map((c) => [c.id, c])), [crops])
  const cropFamilyById = useMemo(() => new Map(cropFamilies.map((f) => [f.id, f])), [cropFamilies])

  const describeCrop = useCallback(
    (variety: Variety): string => {
      const crop = cropById.get(variety.crop_id)
      if (!crop) return '(作物不明)'
      const family = cropFamilyById.get(crop.crop_family_id)
      return family ? `${crop.name}(${family.name})` : crop.name
    },
    [cropById, cropFamilyById],
  )

  const filteredVarieties = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return varieties
    return varieties.filter((v) => {
      const cropLabel = describeCrop(v).toLowerCase()
      return v.name.toLowerCase().includes(keyword) || cropLabel.includes(keyword)
    })
  }, [varieties, search, describeCrop])

  function handleCropCreated(crop: Crop) {
    setCrops((prev) => [...prev, crop])
  }

  return (
    <main className="variety-list-page">
      <h1>品種管理</h1>
      <p className="muted">
        あなたの地域設定: {CLIMATE_ZONE_LABELS[climateZone]}(
        <Link to="/settings">設定画面で変更</Link>)
      </p>

      <div className="variety-toolbar">
        <input
          className="variety-search"
          type="search"
          placeholder="品種名・作物名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true)
              setSelectedVarietyId(null)
            }}
          >
            + 品種を追加
          </button>
        )}
      </div>

      {creating && (
        <VarietyForm
          crops={crops}
          cropFamilies={cropFamilies}
          defaultClimateZone={climateZone}
          onCropCreated={handleCropCreated}
          onSaved={() => {
            setCreating(false)
            void reload()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading && <p>読み込み中...</p>}
      {loadError && <p className="form-error">{loadError}</p>}

      {!loading && !loadError && filteredVarieties.length === 0 && (
        <p className="muted">
          {varieties.length === 0
            ? 'まだ品種が登録されていません。上のボタンから追加してください。'
            : '検索条件に一致する品種がありません。'}
        </p>
      )}

      <ul className="variety-card-list">
        {filteredVarieties.map((variety) => {
          const isSelected = variety.id === selectedVarietyId
          const mySummary = regionSummary(variety.cultivation_calendar?.[climateZone])
          return (
            <li key={variety.id} className="variety-card">
              <button
                type="button"
                className="variety-card-main"
                onClick={() => {
                  setSelectedVarietyId(isSelected ? null : variety.id)
                  setCreating(false)
                }}
              >
                <h2>{variety.name}</h2>
                <p className="muted">{describeCrop(variety)}</p>
                {mySummary ? (
                  <p className="variety-my-region-summary">
                    {CLIMATE_ZONE_LABELS[climateZone]}: {mySummary}
                  </p>
                ) : (
                  <p className="muted">栽培暦({CLIMATE_ZONE_LABELS[climateZone]})未入力</p>
                )}
              </button>

              {isSelected && (
                <VarietyForm
                  crops={crops}
                  cropFamilies={cropFamilies}
                  initialVariety={variety}
                  defaultClimateZone={climateZone}
                  onCropCreated={handleCropCreated}
                  onSaved={() => {
                    setSelectedVarietyId(null)
                    void reload()
                  }}
                  onCancel={() => setSelectedVarietyId(null)}
                  onDeleted={() => {
                    setSelectedVarietyId(null)
                    void reload()
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}

export default VarietyListPage
