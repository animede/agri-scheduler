import type { Bed, BedSegment } from '../api/types'

// 1m = 40px でSVGに描画する。
export const SCALE = 40

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// orientationが"vertical"の場合は畝の長さ(length_m)を縦方向、幅(width_cm)を横方向に描画する。
// それ以外(未設定含む)は"horizontal"として扱い、長さを横方向、幅を縦方向に描画する。
export function isVerticalBed(bed: Pick<Bed, 'orientation'>): boolean {
  return bed.orientation === 'vertical'
}

export function bedRect(bed: Bed): Rect {
  const widthPx = (bed.width_cm / 100) * SCALE
  const lengthPx = bed.length_m * SCALE
  const vertical = isVerticalBed(bed)
  return {
    x: bed.pos_x * SCALE,
    y: bed.pos_y * SCALE,
    width: vertical ? widthPx : lengthPx,
    height: vertical ? lengthPx : widthPx,
  }
}

// 区画は畝の「長さ方向」をstart_offset_m/length_mで按分した位置に描画し、
// 「幅方向」は畝いっぱいに広げる。
export function segmentRect(bed: Bed, segment: BedSegment): Rect {
  const base = bedRect(bed)
  const offsetPx = segment.start_offset_m * SCALE
  const lengthPx = segment.length_m * SCALE
  if (isVerticalBed(bed)) {
    return { x: base.x, y: base.y + offsetPx, width: base.width, height: lengthPx }
  }
  return { x: base.x + offsetPx, y: base.y, width: lengthPx, height: base.height }
}

// 畝ラベル（bed.name + 寸法）がbed矩形の右側にはみ出して描画されるため、
// バウンディングボックスにその概算幅を含めないとSVGの端で文字が切れる。
function estimateLabelWidth(bed: Bed): number {
  const label = `${bed.name}（${bed.length_m}m × ${bed.width_cm}cm）`
  return label.length * 7.5
}

export function boundingBox(beds: Bed[]): Rect {
  if (beds.length === 0) return { x: 0, y: 0, width: 400, height: 300 }
  let maxX = 0
  let maxY = 0
  for (const bed of beds) {
    const r = bedRect(bed)
    maxX = Math.max(maxX, r.x + r.width, r.x + estimateLabelWidth(bed))
    maxY = Math.max(maxY, r.y + r.height)
  }
  return { x: 0, y: 0, width: maxX, height: maxY }
}
