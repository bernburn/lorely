import type { Health, LessonDetail, LessonMetadata } from '../types/lesson'
import { preferenceOptions, type StoryArc, type StoryCreated, type StorySeries } from '../types/story'
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
const integer = (v: unknown, min = 1): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text)
const enumValue = (v: unknown, options: readonly string[]) => typeof v === 'string' && options.includes(v)
export function isLesson(v: unknown): v is LessonMetadata {
  return record(v) && isId(v.lesson_id) && text(v.filename) && text(v.title) && enumValue(v.source, ['pdf', 'sample']) &&
    (v.file_size_bytes === null || integer(v.file_size_bytes, 0)) && integer(v.page_count) && integer(v.character_count) && v.status === 'ready' && date(v.created_at)
}
export function isLessonDetail(v: unknown): v is LessonDetail {
  return isLesson(v) && record(v) && typeof v.extracted_text === 'string' && Array.isArray(v.pages) && v.pages.length === v.page_count &&
    v.pages.every((p, i) => record(p) && p.page_number === i + 1 && typeof p.text === 'string')
}
export function isHealth(v: unknown): v is Health {
  return record(v) && enumValue(v.status, ['ok', 'degraded']) && enumValue(v.database, ['connected', 'not_configured', 'invalid_configuration', 'unavailable']) &&
    enumValue(v.ai, ['configured', 'not_configured']) && (v.message === null || typeof v.message === 'string')
}
export function isCreated(v: unknown): v is StoryCreated { return record(v) && isId(v.series_id) && isId(v.arc_id) && integer(v.arc_number) }
export function isSeries(v: unknown): v is StorySeries {
  return record(v) && isId(v.series_id) && text(v.title) && enumValue(v.genre, preferenceOptions.genre) && enumValue(v.storytelling_style, preferenceOptions.storytelling_style) &&
    Array.isArray(v.arc_ids) && v.arc_ids.length > 0 && v.arc_ids.every(isId) && new Set(v.arc_ids).size === v.arc_ids.length && date(v.created_at) && date(v.updated_at)
}
function answer(v: unknown, ids: Set<string>) {
  return record(v) && strings(v.choices) && v.choices.length >= 2 && v.choices.length <= 6 && new Set(v.choices.map(s => s.toLowerCase())).size === v.choices.length &&
    integer(v.correctIndex, 0) && v.correctIndex < v.choices.length && text(v.hint) && text(v.explanation) && strings(v.relatedConceptIds) &&
    v.relatedConceptIds.length > 0 && v.relatedConceptIds.every(id => ids.has(id))
}
function character(v: unknown, full: boolean) {
  return record(v) && text(v.name) && (!full || text(v.role)) && strings(v.traits) && strings(v.relationships) && strings(v.importantHistory)
}
function continuity(v: unknown) {
  return record(v) && text(v.arcSummary) && text(v.currentState) && typeof v.toneNotes === 'string' &&
    ['importantEvents', 'newEstablishedFacts', 'resolvedThreads', 'unresolvedThreads', 'relationshipUpdates'].every(k => strings(v[k])) &&
    Array.isArray(v.newCharacters) && v.newCharacters.every(c => character(c, true)) && Array.isArray(v.characterUpdates) && v.characterUpdates.every(c => character(c, false))
}
export function isArc(v: unknown): v is StoryArc {
  if (!record(v) || !isCreated(v) || !record(v) || !isId(v.lesson_id) || !text(v.title) || !text(v.summary) || !date(v.created_at) || !continuity(v.continuityUpdate) || !record(v.preferences)) return false
  const prefs = v.preferences
  if (!Object.entries(preferenceOptions).every(([k, options]) => enumValue(prefs[k], options)) || typeof prefs.core_plot !== 'string' || prefs.core_plot.length > 500) return false
  if (!Array.isArray(v.concepts) || !v.concepts.length || !v.concepts.every(c => record(c) && text(c.id) && /^[a-z0-9_-]+$/.test(c.id) && text(c.term) && text(c.definition) && text(c.storyContext))) return false
  const ids = new Set<string>(v.concepts.map(c => c.id))
  if (ids.size !== v.concepts.length || !Array.isArray(v.chapters) || !v.chapters.length || v.chapters.length > 6) return false
  return v.chapters.every((c, i) => record(c) && c.chapterNumber === i + 1 && text(c.title) && Array.isArray(c.blocks) && c.blocks.length > 0 &&
    c.blocks.some(b => record(b) && b.type === 'paragraph') && c.blocks.every(b => record(b) && (b.type === 'paragraph' ? text(b.text) : b.type === 'decision' && text(b.prompt) && answer(b, ids))) &&
    Array.isArray(c.endQuiz) && c.endQuiz.length > 0 && c.endQuiz.every(q => record(q) && text(q.question) && answer(q, ids)))
}
