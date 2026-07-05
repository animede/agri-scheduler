// SeasonWheel(栽培カレンダーの円環ビュー)の日付⇔角度変換、および
// ドーナツ扇形(円弧)のSVGパス生成ロジック。BedMap.tsxがutils/geometry.tsを使うのと
// 同様に、コンポーネント本体から純粋な幾何計算を切り出したもの。

// "YYYY-MM-DD" をローカル日付として解釈する(taskTemplate.ts等の既存実装と同じ方式。
// new Date("YYYY-MM-DD")はUTC解釈されてしまい日付がずれる場合があるため避ける)。
export function parseLocalDate(value: string): Date | null {
  const parts = value.split('-').map(Number)
  const [y, m, d] = parts
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000) + 1
}

// 日付 -> 角度(度)。1月1日が12時位置(-90度)、時計回りに1年で360度進む。
export function dateToAngle(value: string): number | null {
  const d = parseLocalDate(value)
  if (!d) return null
  return (dayOfYear(d) / 365) * 360 - 90
}

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// ドーナツ状の帯(内径rInner〜外径rOuter、開始角度startAngleDeg〜終了角度endAngleDeg)の
// SVG <path> d属性を生成する。外周弧(A) -> 内周へ移動(L) -> 内周弧を逆向きに(A) -> 閉じる(Z)
// の4点+2弧コマンドで構成する標準的な「ドーナツ扇形」パス。
export function donutSectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngleDeg: number,
  endAngleDegRaw: number,
): string {
  let endAngleDeg = endAngleDegRaw
  // ちょうど1周(360度)だと始点・終点が一致してしまい弧が描けないため、わずかに満たない角度に丸める。
  if (endAngleDeg - startAngleDeg >= 359.99) {
    endAngleDeg = startAngleDeg + 359.99
  }
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0
  const outerStart = polarToCartesian(cx, cy, rOuter, startAngleDeg)
  const outerEnd = polarToCartesian(cx, cy, rOuter, endAngleDeg)
  const innerEnd = polarToCartesian(cx, cy, rInner, endAngleDeg)
  const innerStart = polarToCartesian(cx, cy, rInner, startAngleDeg)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}
