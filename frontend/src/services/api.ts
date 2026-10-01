import type { Health, LessonDetail, LessonMetadata } from '../types/lesson'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options, signal: options?.signal ?? AbortSignal.timeout(120_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('The request took too long. Check the backend and database before trying again.')
    }
    throw new Error('Could not reach Lorely. Make sure the backend is running and the API address is correct.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Lorely could not complete this request. Please try again.')
  }
  if (!body) throw new Error('The backend returned an unreadable response.')
  return body as T
}

export const getHealth = () => request<Health>('/api/health')
export const useSampleLesson = () => request<LessonMetadata>('/api/lessons/sample', { method: 'POST' })
export const getLesson = (id: string) => request<LessonDetail>(`/api/lessons/${encodeURIComponent(id)}`)
export function uploadLesson(file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<LessonMetadata>('/api/lessons/upload', { method: 'POST', body })
}
