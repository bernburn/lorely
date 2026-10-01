import { isArc, isCreated, isHealth, isId, isLesson, isLessonDetail, isSeries } from './contracts'
import type { ApiErrorResponse, ContinueStoryRequest, GenerateStoryRequest } from '../types/story'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')
export class ApiError extends Error {
  constructor(message: string, public readonly status: number | null = null, public readonly kind: 'http' | 'network' | 'invalid' = 'http') { super(message); this.name = 'ApiError' }
}
const lessonErrors = [
  "We couldn't read enough text from this PDF. It may contain scanned pages instead of selectable text.",
  'This PDF is too large. The maximum file size is 10 MB.',
]
function errorMessage(path: string, status: number, body: ApiErrorResponse | null) {
  const story = path.includes('/stories/') || path.endsWith('/continue')
  if (status === 429) return "Lorely's story service has reached its request limit. Please try again later."
  if (status === 503) return story ? "Lorely's story service is temporarily busy. Please try again in a moment." : 'The lesson service is temporarily unavailable. Please try again in a moment.'
  if (status === 409) return 'This story has changed since you opened it. Reload the continuation page before trying again.'
  if (status === 404) return path.includes('/arcs/') ? 'This story arc could not be found.' : path.includes('/series/') ? 'This story series could not be found.' : 'This lesson could not be found.'
  if (story) return "Lorely couldn't create this story right now. Please try again."
  if (typeof body?.detail === 'string' && lessonErrors.includes(body.detail)) return body.detail
  if (status === 413) return 'This PDF exceeds the lesson limits. Use a PDF under 10 MB, with at most 80 pages.'
  if (path.endsWith('/upload') && [400, 415, 422].includes(status)) return "We couldn't read this PDF. Use an unprotected PDF with selectable text, up to 80 pages. Scanned pages need selectable text."
  return 'Lorely could not complete this request. Please check your selection and try again.'
}
async function request<T>(path: string, validate: (v: unknown) => v is T, options?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: options?.signal ?? AbortSignal.timeout(180_000) }) }
  catch { throw new ApiError('Could not reach Lorely. Check your connection and try again.', null, 'network') }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(errorMessage(path, response.status, typeof body === 'object' && body !== null ? body as ApiErrorResponse : null), response.status)
  if (!validate(body)) throw new ApiError('Lorely returned an incomplete response. Please try again.', response.status, 'invalid')
  return body
}
const idPath = (prefix: string, id: string) => { if (!isId(id)) throw new ApiError('This link is invalid. Choose another lesson or story.', 400, 'invalid'); return `${prefix}/${encodeURIComponent(id)}` }
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
function sameId(expected: string, actual: string) {
  if (expected.toLowerCase() !== actual.toLowerCase()) throw new ApiError('Lorely returned an incomplete response. Please try again.', 200, 'invalid')
}
export const getHealth = () => request('/api/health', isHealth)
export const useSampleLesson = () => request('/api/lessons/sample', isLesson, { method: 'POST' })
export const getLesson = async (id: string) => { const lesson = await request(idPath('/api/lessons', id), isLessonDetail); sameId(id, lesson.lesson_id); return lesson }
export function uploadLesson(file: File) { const body = new FormData(); body.append('file', file); return request('/api/lessons/upload', isLesson, { method: 'POST', body }) }
export const generateStory = (body: GenerateStoryRequest) => request('/api/stories/generate', isCreated, post(body))
export const getArc = async (id: string) => { const arc = await request(idPath('/api/arcs', id), isArc); sameId(id, arc.arc_id); return arc }
export const getSeries = async (id: string) => { const series = await request(idPath('/api/series', id), isSeries); sameId(id, series.series_id); return series }
export const continueStory = async (id: string, body: ContinueStoryRequest) => {
  const created = await request(`${idPath('/api/series', id)}/continue`, isCreated, post(body))
  sameId(id, created.series_id)
  return created
}
