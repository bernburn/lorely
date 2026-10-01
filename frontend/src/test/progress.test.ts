import { beforeEach, describe, expect, it } from 'vitest'
import { tokenizeConcepts } from '../components/ConceptText'
import { isArc, isSeries } from '../services/contracts'
import { answerQuestion, blankProgress, chapterComplete, decisionKey, finishArc, HISTORY_KEY, knownStories, moveChapter, progressKey, quizKey, restoreProgress, saveProgress } from '../services/progress'
import { justReadArc, series, solveArc } from './fixtures'
beforeEach(() => localStorage.clear())
describe('progress invariants and revision recovery', () => {
  it('rejects wrong answers, hidden decisions, quizzes before Decisions, locked navigation and premature completion in state logic', () => {
    const p = blankProgress(solveArc)
    expect(answerQuestion(solveArc, p, decisionKey(0, 1), 1)).toBe(p)
    expect(answerQuestion(solveArc, p, quizKey(0, 0), 0)).toBe(p)
    expect(answerQuestion(solveArc, p, quizKey(1, 0), 0)).toBe(p)
    expect(moveChapter(solveArc, p, 1)).toBe(p); expect(moveChapter(solveArc, p, -1)).toBe(p); expect(moveChapter(solveArc, p, NaN)).toBe(p)
    expect(finishArc(solveArc, p)).toBe(p)
  })
  it('requires sequential Decisions before revealing or accepting later ones', () => {
    const block = solveArc.chapters[0].blocks[1]
    const arc = { ...solveArc, chapters: [{ ...solveArc.chapters[0], blocks: [...solveArc.chapters[0].blocks, block] }, solveArc.chapters[1]] }
    const p = blankProgress(arc)
    expect(answerQuestion(arc, p, decisionKey(0, 3), 0)).toBe(p)
    const first = answerQuestion(arc, p, decisionKey(0, 1), 0)
    expect(answerQuestion(arc, first, quizKey(0, 0), 0)).toBe(first)
    expect(answerQuestion(arc, first, decisionKey(0, 3), 0).completed).toHaveLength(2)
  })
  it('restores only coherent completions and clamps a tampered current chapter', () => {
    const p = blankProgress(solveArc)
    saveProgress(solveArc, { ...p, chapter: 99, completed: [quizKey(0, 0), quizKey(1, 0), 'bogus'], finished: true })
    const restored = restoreProgress(solveArc)
    expect(restored.progress.chapter).toBe(0); expect(restored.progress.completed).toEqual([]); expect(restored.progress.finished).toBe(false); expect(restored.recovered).toBe(true)
  })
  it('does not trust a saved unlocked chapter or completions beyond the first incomplete chapter', () => {
    saveProgress(justReadArc, { ...blankProgress(justReadArc), chapter: 1, completed: [quizKey(0, 0), quizKey(1, 0)] })
    const { progress } = restoreProgress(justReadArc)
    expect(progress.chapter).toBe(0); expect(progress.completed).toEqual([quizKey(0, 0)]); expect(chapterComplete(justReadArc, progress, 0)).toBe(false)
  })
  it('invalidates old progress when quiz answers or concept content change without duplicating the story', () => {
    const p = answerQuestion(solveArc, blankProgress(solveArc), decisionKey(0, 1), 0)
    saveProgress(solveArc, p)
    const arc = { ...solveArc, concepts: solveArc.concepts.map(c => ({ ...c, definition: 'An updated definition.' })) }
    expect(restoreProgress(arc).progress.completed).toEqual([])
    const saved = localStorage.getItem(progressKey(solveArc.arc_id))!
    expect(saved).not.toContain('Mira'); expect(saved).not.toContain('chapters'); expect(saved).not.toContain('definition')
  })
  it('filters malformed history safely and bounds remembered series', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([null, {}, { series_id: series.series_id, arc_id: solveArc.arc_id }, { series_id: series.series_id, arc_id: solveArc.arc_id }]))
    expect(knownStories()).toHaveLength(1)
  })
})
describe('safe concept matching and response validation', () => {
  it('handles repeated terms, case, overlapping terms, Unicode boundaries and regex punctuation as text', () => {
    const concepts = [...solveArc.concepts, { ...solveArc.concepts[0], id: 'c-plus', term: 'C++' }]
    const parts = tokenizeConcepts('Router router Routerboard routing table C++ éRouter <script>Router</script>', concepts)
    expect(parts.filter(p => p.concept).map(p => p.text)).toEqual(['Router', 'router', 'routing table', 'C++', 'Router'])
    expect(parts.map(p => p.text).join('')).toBe('Router router Routerboard routing table C++ éRouter <script>Router</script>')
  })
  it('accepts the backend public shapes and rejects malformed answers, missing quizzes and concept references', () => {
    expect(isArc(solveArc)).toBe(true); expect(isArc(justReadArc)).toBe(true); expect(isSeries(series)).toBe(true)
    const invalidAnswer = { ...solveArc, chapters: [{ ...solveArc.chapters[0], endQuiz: [{ ...solveArc.chapters[0].endQuiz[0], correctIndex: 99 }] }] }
    expect(isArc(invalidAnswer)).toBe(false)
    expect(isArc({ ...solveArc, chapters: [{ ...solveArc.chapters[0], endQuiz: [] }] })).toBe(false)
    expect(isArc({ ...solveArc, concepts: [] })).toBe(false)
    expect(isArc({ ...solveArc, continuityUpdate: null })).toBe(false)
    expect(isSeries({ ...series, arc_ids: ['bad'] })).toBe(false)
  })
})
