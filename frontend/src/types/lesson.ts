export interface LessonMetadata {
  lesson_id: string
  filename: string
  title: string
  source: 'pdf' | 'sample'
  file_size_bytes: number | null
  page_count: number
  character_count: number
  status: 'ready'
  created_at: string
}

export interface LessonDetail extends LessonMetadata {
  pages: { page_number: number; text: string }[]
  extracted_text: string
}

export interface Health {
  status: 'ok' | 'degraded'
  database: 'connected' | 'not_configured' | 'invalid_configuration' | 'unavailable'
  ai: 'configured' | 'not_configured'
  message: string | null
}
