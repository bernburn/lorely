// Deterministic educational UI fixtures. Never imported by production routes or API services.
import { defaultPreferences, type StoryArc, type StorySeries } from '../types/story'
import type { LessonDetail } from '../types/lesson'
export const lesson: LessonDetail = {
  lesson_id: '507f1f77bcf86cd799439011', filename: 'networks.pdf', title: 'Introduction to Computer Networks',
  source: 'pdf', file_size_bytes: 2048, page_count: 2, character_count: 1200, status: 'ready', created_at: '2026-10-01T00:00:00Z',
  pages: [{ page_number: 1, text: 'Routers forward packets.' }, { page_number: 2, text: 'Switches connect devices.' }], extracted_text: 'Routers forward packets.\n\nSwitches connect devices.',
}
export const series: StorySeries = {
  series_id: '507f1f77bcf86cd799439012', title: 'The Archive Network', genre: 'Mystery', storytelling_style: 'Grounded',
  arc_ids: ['507f1f77bcf86cd799439013'], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
}
const answers = { choices: ['A route to the archive network', 'A different monitor'], correctIndex: 0, hint: 'Think about where a packet needs to go.', explanation: 'A routing table tells the router how to reach a destination network.', relatedConceptIds: ['router'] }
export const solveArc: StoryArc = {
  arc_id: series.arc_ids[0], series_id: series.series_id, lesson_id: lesson.lesson_id, arc_number: 1,
  preferences: { ...defaultPreferences, genre: 'Mystery', interaction_mode: 'Solve Along', length: 'Quick' },
  title: 'The Message That Never Arrived', summary: 'Mira follows a missing packet through the school network.', created_at: '2026-10-01T00:00:00Z',
  concepts: [
    { id: 'router', term: 'Router', definition: 'A networking device that forwards packets between networks.', storyContext: 'Mira checks the router at the archive crossroads.' },
    { id: 'routing-table', term: 'Routing Table', definition: 'A record of routes to destination networks.', storyContext: 'The missing route explains the failed delivery.' },
  ],
  chapters: [
    { chapterNumber: 1, title: 'The Quiet Archive', blocks: [
      { type: 'paragraph', text: 'Mira checked the Router. The router stood beside a routing table, waiting for the missing message.' },
      { type: 'decision', prompt: 'What should Mira inspect in the router?', ...answers },
      { type: 'paragraph', text: 'The archive lights blinked back to life. Mira had found the missing route.' },
    ], endQuiz: [
      { question: 'What information was missing?', ...answers },
      { question: 'What helps a router find a destination?', ...answers },
    ] },
    { chapterNumber: 2, title: 'A Message Home', blocks: [{ type: 'paragraph', text: 'The Router forwarded the packet. The archive was connected again.' }], endQuiz: [{ question: 'Why could the message reach the archive now?', ...answers }] },
  ],
  continuityUpdate: { arcSummary: 'The archive route is restored.', newCharacters: [], characterUpdates: [], importantEvents: [], newEstablishedFacts: [], resolvedThreads: [], unresolvedThreads: [], currentState: 'Mira is at the archive.', relationshipUpdates: [], toneNotes: '' },
}
export const justReadArc: StoryArc = { ...solveArc, preferences: { ...solveArc.preferences, interaction_mode: 'Just Read' }, chapters: solveArc.chapters.map(c => ({ ...c, blocks: c.blocks.filter(b => b.type === 'paragraph') })) }
export const nextLesson: LessonDetail = { ...lesson, lesson_id: '507f1f77bcf86cd799439014', title: 'Network Security' }
export const nextArc: StoryArc = { ...justReadArc, arc_id: '507f1f77bcf86cd799439015', arc_number: 2, lesson_id: nextLesson.lesson_id, title: 'The Next Mystery', chapters: justReadArc.chapters.map((c, i) => ({ ...c, title: i === 0 ? 'The Breach' : c.title })) }
export const health = { status: 'ok', database: 'connected', ai: 'configured', message: null }
