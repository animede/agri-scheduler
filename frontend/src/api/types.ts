// バックエンド(backend/app/schemas/*.py)のPydanticスキーマに対応するTS型定義。

export interface Field {
  id: number
  name: string
  location_note: string | null
  area_sqm: number | null
}

export type FieldCreate = Omit<Field, 'id'>
export type FieldUpdate = Partial<FieldCreate>

// orientationは"horizontal"(既定・畝の長さ方向=横)または"vertical"(長さ方向=縦)を想定。
// バックエンド上はただの文字列(null許容)のため、未設定時はhorizontal相当として扱う。
export type BedOrientation = 'horizontal' | 'vertical'

export interface Bed {
  id: number
  field_id: number
  name: string
  length_m: number
  width_cm: number
  orientation: string | null
  pos_x: number
  pos_y: number
}

export type BedCreate = Omit<Bed, 'id'>
export type BedUpdate = Partial<BedCreate>

export interface BedSegment {
  id: number
  bed_id: number
  name: string | null
  start_offset_m: number
  length_m: number
}

export type BedSegmentCreate = Omit<BedSegment, 'id'>
export type BedSegmentUpdate = Partial<BedSegmentCreate>

export interface CropFamily {
  id: number
  name: string
  rotation_interval_years: number
  notes: string | null
}

export type CropFamilyCreate = Omit<CropFamily, 'id'>
export type CropFamilyUpdate = Partial<CropFamilyCreate>

export interface Crop {
  id: number
  name: string
  crop_family_id: number
}

export type CropCreate = Omit<Crop, 'id'>
export type CropUpdate = Partial<CropCreate>

// 地域帯(寒地/温暖地/暖地)ごとの時期情報。種袋裏面の栽培歴表は地域帯別に
// 種蒔き・植え付け・収穫の時期が分かれて記載されることが多い(spec.md 4.2)ため、
// 自由入力の文字列(例: "3月上旬〜4月上旬")として保持する。
export interface RegionCalendar {
  sowing?: string // 種蒔き時期
  transplanting?: string // 植え付け時期
  harvest?: string // 収穫時期
}

export type ClimateZone = 'cold' | 'temperate' | 'warm'

// バックエンドは自由形式JSONカラム(dict[str, Any] | None)として保存するため、
// スキーマ変更は不要。フロント側でこの形状を前提として扱う。
export interface CultivationCalendar {
  cold?: RegionCalendar // 寒地
  temperate?: RegionCalendar // 温暖地
  warm?: RegionCalendar // 暖地
}

export interface Variety {
  id: number
  crop_id: number
  name: string
  cultivation_calendar: CultivationCalendar | null
  seedling_days: number | null
  days_to_harvest: number | null
  plant_spacing_cm: number | null
  row_spacing_cm: number | null
  mulch_type: string | null
  protection_notes: string | null
  source_image_path: string | null
  ai_extracted_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type VarietyCreate = Omit<Variety, 'id' | 'created_at' | 'updated_at'>
export type VarietyUpdate = Partial<VarietyCreate>

export type PlantingStatus = '計画' | '育苗中' | '植付済' | '収穫中' | '完了'

export interface Planting {
  id: number
  bed_segment_id: number
  variety_id: number
  year: number
  planned_sowing_date: string | null
  actual_sowing_date: string | null
  planned_transplant_date: string | null
  actual_transplant_date: string | null
  planned_harvest_start_date: string | null
  actual_harvest_start_date: string | null
  planned_harvest_end_date: string | null
  actual_harvest_end_date: string | null
  status: PlantingStatus
  notes: string | null
}

export type PlantingCreate = Omit<Planting, 'id'>
export type PlantingUpdate = Partial<PlantingCreate>
