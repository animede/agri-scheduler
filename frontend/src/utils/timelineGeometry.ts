// SeasonTimeline(栽培カレンダーの横方向タイムラインビュー)の日付⇔X座標変換ロジック。
// BedMap.tsxがutils/geometry.tsを使うのと同様に、コンポーネント本体から純粋な
// 幾何計算を切り出したもの。旧SeasonWheel用のutils/seasonWheelGeometry.ts(日付→角度)を
// 日付→X座標に置き換えたもの。

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

function daysInYear(year: number): number {
  return Math.round((new Date(year, 11, 31).getTime() - new Date(year, 0, 1).getTime()) / 86_400_000) + 1
}

// 日付 -> チャート幅内のX座標(0〜width)。年始(1/1)が0、年末(12/31)がwidthに対応する。
export function dateToX(value: string, width: number, year: number): number | null {
  const d = parseLocalDate(value)
  if (!d) return null
  return ((dayOfYear(d) - 1) / daysInYear(year)) * width
}

// 指定年の各月初め(1〜12月)のX座標一覧(目盛り線・月名ラベル用)。
export function monthStartXs(width: number, year: number): number[] {
  const total = daysInYear(year)
  const xs: number[] = []
  for (let m = 0; m < 12; m++) {
    const doy = dayOfYear(new Date(year, m, 1))
    xs.push(((doy - 1) / total) * width)
  }
  return xs
}
