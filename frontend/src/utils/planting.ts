import type { Planting } from '../api/types'

// 区画の「現在の作付け」を1件決定する。
// 仕様: 「yearが最も新しい、または今日の年に一致するPlanting」を現在の作付けとみなす。
// -> 今年(currentYear)のPlantingがあればそれを優先し、無ければ最新年のPlantingを採用する。
// 同一年に複数件ある場合はid最大(=最後に登録されたもの)を採用する。
export function pickCurrentPlanting(
  plantings: Planting[],
  currentYear: number,
): Planting | null {
  if (plantings.length === 0) return null

  const thisYear = plantings.filter((p) => p.year === currentYear)
  const candidates = thisYear.length > 0 ? thisYear : plantings

  return candidates.reduce((latest, p) => {
    if (p.year !== latest.year) return p.year > latest.year ? p : latest
    return p.id > latest.id ? p : latest
  }, candidates[0])
}

// 現在の作付け以外の履歴を年降順(同年ならid降順)で並べる。
export function sortHistory(plantings: Planting[], current: Planting | null): Planting[] {
  return plantings
    .filter((p) => p.id !== current?.id)
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.id - a.id))
}
