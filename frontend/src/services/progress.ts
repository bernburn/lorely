import { isId } from './contracts'
import type { StoryArc, StoryCreated } from '../types/story'

export const HISTORY_KEY = 'lorely.history.v1'
export const progressKey = (id: string) => `lorely.progress.v1.${id}`
export interface KnownStory { series_id: string; arc_id: string }
export interface ReadingProgress { version: 1; fingerprint: string; chapter: number; completed: string[]; finished: boolean }
export const decisionKey = (chapter: number, block: number) => `c${chapter}.d${block}`
export const quizKey = (chapter: number, quiz: number) => `c${chapter}.q${quiz}`
function read(key: string): unknown { try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null } }
function write(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false } }
export function knownStories(): KnownStory[] {
  const value = read(HISTORY_KEY)
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.filter((v): v is KnownStory => {
    if (typeof v !== 'object' || v === null || !isId(v.series_id) || !isId(v.arc_id) || seen.has(v.series_id)) return false
    seen.add(v.series_id); return true
  }).slice(0, 20)
}
export function rememberStory(story: Pick<StoryCreated, 'series_id' | 'arc_id'>) {
  if (isId(story.series_id) && isId(story.arc_id)) write(HISTORY_KEY, [story, ...knownStories().filter(s => s.series_id !== story.series_id)].slice(0, 20))
}
export const forgetStory = (id: string) => write(HISTORY_KEY, knownStories().filter(s => s.series_id !== id))
export const forgetArc = (id: string) => write(HISTORY_KEY, knownStories().filter(s => s.arc_id.toLowerCase() !== id.toLowerCase()))
function fingerprint(arc: StoryArc) {
  // Store only a revision signature, never a second copy of the story.
  const value = JSON.stringify([arc.created_at, arc.preferences.interaction_mode, arc.chapters, arc.concepts])
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return `${arc.arc_id}:${hash >>> 0}`
}
export const blankProgress = (arc: StoryArc): ReadingProgress => ({ version: 1, fingerprint: fingerprint(arc), chapter: 0, completed: [], finished: false })
export function requiredDecisions(arc: StoryArc, chapter: number) {
  return arc.preferences.interaction_mode === 'Just Read' ? [] : arc.chapters[chapter].blocks.flatMap((b, i) => b.type === 'decision' ? [decisionKey(chapter, i)] : [])
}
export function chapterComplete(arc: StoryArc, p: ReadingProgress, chapter: number) {
  return [...requiredDecisions(arc, chapter), ...arc.chapters[chapter].endQuiz.map((_, i) => quizKey(chapter, i))].every(key => p.completed.includes(key))
}
export function unlockedChapter(arc: StoryArc, p: ReadingProgress) {
  let index = 0
  while (index < arc.chapters.length - 1 && chapterComplete(arc, p, index)) index++
  return index
}
export function restoreProgress(arc: StoryArc): { progress: ReadingProgress; recovered: boolean } {
  const empty = blankProgress(arc)
  const raw = read(progressKey(arc.arc_id))
  if (raw === null) {
    let recovered = false
    try { recovered = localStorage.getItem(progressKey(arc.arc_id)) !== null } catch { /* Storage may be disabled. */ }
    return { progress: empty, recovered }
  }
  if (typeof raw !== 'object' || !('version' in raw) || raw.version !== 1 || !('fingerprint' in raw) || raw.fingerprint !== empty.fingerprint ||
    !('completed' in raw) || !Array.isArray(raw.completed) || !raw.completed.every(k => typeof k === 'string')) return { progress: empty, recovered: true }
  const saved = new Set<string>(raw.completed)
  const p = { ...empty }
  // Ignore completions beyond the first locked chapter, and quizzes before its Decisions.
  for (let c = 0; c < arc.chapters.length; c++) {
    for (const key of requiredDecisions(arc, c)) { if (!saved.has(key)) break; p.completed.push(key) }
    if (requiredDecisions(arc, c).every(k => p.completed.includes(k))) {
      for (let q = 0; q < arc.chapters[c].endQuiz.length; q++) { const k = quizKey(c, q); if (saved.has(k)) p.completed.push(k) }
    }
    if (!chapterComplete(arc, p, c)) break
  }
  const max = unlockedChapter(arc, p)
  p.chapter = 'chapter' in raw && typeof raw.chapter === 'number' && Number.isInteger(raw.chapter) ? Math.max(0, Math.min(raw.chapter, max)) : 0
  p.finished = 'finished' in raw && raw.finished === true && arc.chapters.every((_, i) => chapterComplete(arc, p, i))
  return { progress: p, recovered: p.completed.length !== saved.size || !('chapter' in raw) || raw.chapter !== p.chapter }
}
export const saveProgress = (arc: StoryArc, p: ReadingProgress) => write(progressKey(arc.arc_id), p)
export function answerQuestion(arc: StoryArc, p: ReadingProgress, key: string, choice: number): ReadingProgress {
  const c = p.chapter
  if (c > unlockedChapter(arc, p) || p.finished) return p
  const decisions = requiredDecisions(arc, c)
  const first = decisions.find(k => !p.completed.includes(k))
  const blockIndex = arc.chapters[c].blocks.findIndex((_, i) => decisionKey(c, i) === key)
  const block = arc.chapters[c].blocks[blockIndex]
  const qIndex = arc.chapters[c].endQuiz.findIndex((_, i) => quizKey(c, i) === key)
  const question = first === key && block?.type === 'decision' ? block : !first && qIndex >= 0 ? arc.chapters[c].endQuiz[qIndex] : null
  if (!question || choice !== question.correctIndex || p.completed.includes(key)) return p
  return { ...p, completed: [...p.completed, key] }
}
export function moveChapter(arc: StoryArc, p: ReadingProgress, target: number): ReadingProgress {
  if (!Number.isInteger(target) || target < 0 || target > unlockedChapter(arc, p)) return p
  return { ...p, chapter: target, finished: false }
}
export function finishArc(arc: StoryArc, p: ReadingProgress): ReadingProgress {
  return arc.chapters.every((_, i) => chapterComplete(arc, p, i)) ? { ...p, finished: true } : p
}
