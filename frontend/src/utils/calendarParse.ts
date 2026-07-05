// 栽培暦の自由記述文字列(例:「3月上旬〜4月上旬」「6月」)を、指定年におけるおおよその
// 日付範囲に変換するパーサー(spec.md 4.8「作業と時期の推測」)。
//
// 注意: これはあくまで「近似的な推測」であり、正確な日付ではない。
// 上旬=その月の5日、中旬=15日、下旬=25日、「上旬/中旬/下旬」の指定が無い場合は15日と近似する。
// パースできない文字列(空欄・「梅雨明け後」のようにフォーマット外のもの等)はnullを返す。

export interface ParsedPeriod {
  start: Date
  end: Date
}

// "(\d{1,2})月(上旬|中旬|下旬)?" にマッチする箇所を先頭から2つまで拾う。
// 「〜」「~」「-」等の区切り文字そのものは特定の記号に限定せず、
// テキスト中に現れる月表現の1つ目を開始、2つ目を終了とみなす
// (「4月下旬〜5月中旬」「4月下旬から5月中旬」等、区切り語が何であっても頑健に扱えるようにするため)。
const PERIOD_RE = /(\d{1,2})月\s*(上旬|中旬|下旬)?/g

function dayForPart(part: string | undefined): number {
  if (part === '上旬') return 5
  if (part === '下旬') return 25
  // '中旬' および指定なしはともに15日と近似する
  return 15
}

export function parsePeriodText(
  text: string | null | undefined,
  year: number,
): ParsedPeriod | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  const matches = [...trimmed.matchAll(PERIOD_RE)]
  if (matches.length === 0) return null

  const toDate = (m: RegExpMatchArray): Date | null => {
    const month = Number(m[1])
    if (!Number.isInteger(month) || month < 1 || month > 12) return null
    return new Date(year, month - 1, dayForPart(m[2]))
  }

  const first = toDate(matches[0])
  if (!first) return null

  // 2箇所目が無ければ開始=終了として単日的に扱う
  const second = matches.length > 1 ? toDate(matches[1]) : null
  const end = second ?? first

  // 記述の前後関係が逆転していた場合(誤記等)は開始・終了を入れ替えて救済する
  if (end.getTime() < first.getTime()) {
    return { start: end, end: first }
  }
  return { start: first, end }
}
