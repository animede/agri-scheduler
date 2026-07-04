import type { Bed, BedSegment } from '../api/types'
import { bedRect, boundingBox, segmentRect } from '../utils/geometry'
import { EMPTY_SEGMENT_COLOR } from '../utils/cropFamilyColor'
import './BedMap.css'

interface BedMapProps {
  beds: Bed[]
  segmentsByBed: Map<number, BedSegment[]>
  getSegmentColor: (segment: BedSegment) => string | null
  selectedBedId: number | null
  selectedSegmentId: number | null
  onSelectBed: (bedId: number) => void
  onSelectSegment: (segment: BedSegment) => void
}

const PADDING = 40

function BedMap({
  beds,
  segmentsByBed,
  getSegmentColor,
  selectedBedId,
  selectedSegmentId,
  onSelectBed,
  onSelectSegment,
}: BedMapProps) {
  const box = boundingBox(beds)
  const viewBox = `${-PADDING} ${-PADDING} ${box.width + PADDING * 2} ${box.height + PADDING * 2}`

  if (beds.length === 0) {
    return (
      <div className="bed-map-empty">
        まだ畝が登録されていません。「畝を追加」から最初の畝を作成してください。
      </div>
    )
  }

  return (
    <svg
      className="bed-map"
      viewBox={viewBox}
      width="100%"
      role="img"
      aria-label="圃場マップ"
    >
      {beds.map((bed) => {
        const rect = bedRect(bed)
        const segments = segmentsByBed.get(bed.id) ?? []
        const isBedSelected = bed.id === selectedBedId

        return (
          <g key={bed.id}>
            {/* 畝本体の枠(クリックで畝を選択、区画が無い場合は空き色で塗る) */}
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              className={`bed-rect${isBedSelected ? ' bed-rect--selected' : ''}`}
              fill={segments.length === 0 ? EMPTY_SEGMENT_COLOR : 'none'}
              onClick={() => onSelectBed(bed.id)}
            >
              <title>{bed.name}</title>
            </rect>

            {segments.map((segment) => {
              const segRect = segmentRect(bed, segment)
              const color = getSegmentColor(segment) ?? EMPTY_SEGMENT_COLOR
              const isSegSelected = segment.id === selectedSegmentId
              return (
                <rect
                  key={segment.id}
                  x={segRect.x}
                  y={segRect.y}
                  width={Math.max(segRect.width, 0)}
                  height={Math.max(segRect.height, 0)}
                  fill={color}
                  className={`segment-rect${isSegSelected ? ' segment-rect--selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectSegment(segment)
                  }}
                >
                  <title>{segment.name ?? `区画#${segment.id}`}</title>
                </rect>
              )
            })}

            <text
              x={rect.x + 2}
              y={rect.y - 6}
              className="bed-label"
            >
              {bed.name}（{bed.length_m}m × {bed.width_cm}cm）
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default BedMap
