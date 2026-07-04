// CropFamily名 -> 固定パレットの色 への決定的なマッピング。
// 同じ科は常に同じ色になるよう、文字列の簡易ハッシュ値でパレットのインデックスを選ぶ。

// 8科(仕様書4.2の初期マスタ)以上でも色が足りるよう、視認性を優先した10色パレット。
const PALETTE = [
  '#e07a5f', // テラコッタ
  '#81b29a', // セージグリーン
  '#f2cc8f', // マスタード
  '#3d5a80', // ネイビー
  '#9d8189', // モーブ
  '#e9c46a', // イエロー
  '#6d9dc5', // スカイブルー
  '#a6808c', // ダスティピンク
  '#588157', // フォレストグリーン
  '#bc6c25', // ブラウン
]

// 作付けなし(空き区画)を表す色
export const EMPTY_SEGMENT_COLOR = '#e5e4e7'

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function colorForCropFamily(familyName: string): string {
  const index = hashString(familyName) % PALETTE.length
  return PALETTE[index]
}
