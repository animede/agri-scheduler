// Phase6: 種苗会社画像のAI解析API(backend/app/api/ai_analysis.py)呼び出し。

import { apiPostForm } from './client'
import type { AnalyzeVarietyImageResponse } from './types'

const ENDPOINT = '/api/ai/analyze-variety-image'

export function analyzeVarietyImage(file: File): Promise<AnalyzeVarietyImageResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostForm<AnalyzeVarietyImageResponse>(ENDPOINT, formData)
}
