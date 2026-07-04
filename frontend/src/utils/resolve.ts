import type { Crop, CropFamily, Variety } from '../api/types'

export interface Lookups {
  varietyById: Map<number, Variety>
  cropById: Map<number, Crop>
  cropFamilyById: Map<number, CropFamily>
}

export interface ResolvedVariety {
  variety?: Variety
  crop?: Crop
  cropFamily?: CropFamily
}

// Planting.variety_id から Variety -> Crop -> CropFamily を辿って解決する。
// マスタ未取得・不整合等でどこかが見つからない場合は、そこで解決を止めてundefinedを返す。
export function resolveVariety(varietyId: number, lookups: Lookups): ResolvedVariety {
  const variety = lookups.varietyById.get(varietyId)
  if (!variety) return {}
  const crop = lookups.cropById.get(variety.crop_id)
  if (!crop) return { variety }
  const cropFamily = lookups.cropFamilyById.get(crop.crop_family_id)
  return { variety, crop, cropFamily }
}
