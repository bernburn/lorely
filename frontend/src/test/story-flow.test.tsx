import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { health, justReadArc, lesson, nextArc, nextLesson, series, solveArc } from './fixtures'
import type { StoryArc } from '../types/story'
import { HISTORY_KEY, progressKey } from '../services/progress'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn<typeof fetch>()
let activeArc: StoryArc
let continued = false
function normalFetch(input: RequestInfo | URL) {
  const path = String(input)
  if (path.endsWith('/continue')) { continued = true; return Promise.resolve(json({ series_id: series.series_id, arc_id: nextArc.arc_id, arc_number: 2 }, 201)) }
  return Promise.resolve(path.endsWith('/api/health') ? json(health) : path.endsWith('/api/arcs/' + nextArc.arc_id) ? json(nextArc) : path.includes('/api/arcs/') ? json(activeArc) : path.endsWith(`/api/series/${series.series_id}`) ? json(continued ? { ...series, arc_ids: [...series.arc_ids, nextArc.arc_id] } : series) : path.endsWith('/api/lessons/' + nextLesson.lesson_id) ? json(nextLesson) : path.includes('/api/lessons/') ? json(lesson) : json({ series_id: series.series_id, arc_id: activeArc.arc_id, arc_number: 1 }, 201))
}
beforeEach(() => { localStorage.clear(); activeArc = solveArc; continued = false; fetchMock.mockReset(); fetchMock.mockImplementation(normalFetch); vi.stubGlobal('fetch', fetchMock) })
function mount(route = '/create') { return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>) }
async function read(arc = solveArc) { activeArc = arc; const ui = mount(`/read/${arc.arc_id}`); await screen.findByRole('heading', { name: 'The Quiet Archive' }); return ui }
async function solveDecision() { await userEvent.click(within(screen.getByRole('region', { name: 'Story decision' })).getByRole('button', { name: 'A route to the archive network' })) }
async function answerQuizzes() {
  for (const section of screen.getAllByRole('region', { name: /Chapter question/ })) await userEvent.click(within(section).getByRole('button', { name: 'A route to the archive network' }))
}
describe('personalization and generation', () => {
  it('shows exact defaults with separate Genre, Story Style and Interaction controls', () => {
    mount(); expect((screen.getByLabelText('Genre') as HTMLSelectElement).value).toBe('Adventure')
    expect((screen.getByLabelText('Story Style') as HTMLSelectElement).value).toBe('Grounded')
    expect((screen.getByLabelText('Interaction Mode') as HTMLSelectElement).value).toBe('Just Read')
    expect((screen.getByLabelText('Tone') as HTMLSelectElement).value).toBe('Dramatic')
    expect((screen.getByLabelText('Story Length') as HTMLSelectElement).value).toBe('Standard')
    expect((screen.getByLabelText('Education Level') as HTMLSelectElement).value).toBe('Senior High')
    expect((screen.getByLabelText('Story Complexity') as HTMLSelectElement).value).toBe('Balanced')
    expect(screen.getByLabelText(/Core Plot/).getAttribute('maxlength')).toBe('500')
    expect(screen.getByRole('button', { name: 'Create Story' }).hasAttribute('disabled')).toBe(true)
  })
  it('sends every chosen preference and the real saved Lesson ID, then opens the returned Arc', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Try a Sample Lesson' })); await screen.findByRole('heading', { name: 'Lesson ready' })
    await userEvent.selectOptions(screen.getByLabelText('Genre'), 'Mystery'); await userEvent.selectOptions(screen.getByLabelText('Story Style'), 'You Decide')
    await userEvent.selectOptions(screen.getByLabelText('Interaction Mode'), 'Solve Along'); await userEvent.type(screen.getByLabelText(/Core Plot/), 'A missing message.')
    await userEvent.click(screen.getByRole('button', { name: 'Create Story' })); await screen.findByRole('heading', { name: 'The Quiet Archive' })
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/stories/generate'))!
    const body = JSON.parse(call[1]?.body as string)
    expect(body.lesson_id).toBe(lesson.lesson_id); expect(body.preferences).toEqual({ genre: 'Mystery', storytelling_style: 'You Decide', interaction_mode: 'Solve Along', tone: 'Dramatic', length: 'Standard', education_level: 'Senior High', complexity: 'Balanced', core_plot: 'A missing message.' })
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)[0].series_id).toBe(series.series_id)
  })
  it('blocks duplicate generation and changes to the Lesson and preferences while active', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Try a Sample Lesson' })); await screen.findByRole('heading', { name: 'Lesson ready' })
    let finish!: (value: Response) => void
    fetchMock.mockImplementation(input => String(input).endsWith('/api/stories/generate') ? new Promise(resolve => { finish = resolve }) : normalFetch(input))
    const form = screen.getByRole('button', { name: 'Create Story' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/stories/generate'))).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Change PDF' }).hasAttribute('disabled')).toBe(true)
    expect((screen.getByLabelText('Genre') as HTMLSelectElement).closest('fieldset')!.disabled).toBe(true)
    finish(json({ detail: 'private internal error' }, 503)); expect((await screen.findByRole('alert')).textContent).toContain('temporarily busy')
    expect(screen.getByRole('button', { name: 'Retry' }).hasAttribute('disabled')).toBe(false)
  })
  it.each([429, 503, 502])('keeps generation failure %s clean, with no automatic retry or fixture substitution', async status => {
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Try a Sample Lesson' })); await screen.findByRole('heading', { name: 'Lesson ready' })
    fetchMock.mockImplementation(input => String(input).endsWith('/api/stories/generate') ? Promise.resolve(json({ detail: 'SECRET SDK TRACE' }, status)) : normalFetch(input))
    await userEvent.click(screen.getByRole('button', { name: 'Create Story' })); const error = await screen.findByRole('alert')
    expect(error.textContent).not.toContain('SECRET'); expect(screen.queryByRole('heading', { name: 'The Quiet Archive' })).toBeNull()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/stories/generate'))).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
describe('the Story Reader', () => {
  it('renders real metadata and summary, highlights repeated whole terms and separates fact from story context', async () => {
    await read(); expect(screen.getByText(series.title)).toBeTruthy()
    expect(screen.getByText(/Arc 1 · Chapter 1/)).toBeTruthy(); expect(screen.getByText(solveArc.summary)).toBeTruthy()
    const terms = screen.getAllByRole('button', { name: 'Review concept: Router' }); expect(terms).toHaveLength(2)
    await userEvent.click(terms[0]); const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Lesson Definition' })).toBeTruthy()
    expect(within(dialog).getByText(solveArc.concepts[0].definition)).toBeTruthy()
    expect(within(dialog).getByRole('heading', { name: 'In This Story' })).toBeTruthy()
    await userEvent.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(terms[0])
  })
  it('keeps Just Read uninterrupted and requires all chapter quizzes', async () => {
    await read(justReadArc); expect(screen.queryByRole('region', { name: 'Story decision' })).toBeNull()
    expect(screen.getByText(/archive lights blinked/)).toBeTruthy(); expect(screen.getByRole('heading', { name: 'Check Your Understanding' })).toBeTruthy()
    const next = screen.getByRole('button', { name: 'Continue →' }); expect(next.hasAttribute('disabled')).toBe(true)
    await userEvent.click(within(screen.getByRole('region', { name: 'Chapter question 1' })).getByRole('button', { name: 'A route to the archive network' }))
    expect(next.hasAttribute('disabled')).toBe(true)
    await userEvent.click(within(screen.getByRole('region', { name: 'Chapter question 2' })).getByRole('button', { name: 'A route to the archive network' }))
    expect(next.hasAttribute('disabled')).toBe(false)
    await userEvent.click(next); expect(screen.getByRole('heading', { name: 'A Message Home' })).toBeTruthy()
  })
  it('provides a hint and retry without revealing the correct explanation after an incorrect Decision', async () => {
    await read(); const decision = screen.getByRole('region', { name: 'Story decision' })
    await userEvent.click(within(decision).getByRole('button', { name: 'A different monitor' }))
    expect(within(decision).getByText(/Not quite/)).toBeTruthy(); expect(within(decision).queryByText(/A routing table tells/)).toBeNull()
    expect(screen.queryByText(/archive lights blinked/)).toBeNull(); expect(screen.queryByRole('heading', { name: 'Check Your Understanding' })).toBeNull()
    await userEvent.click(within(decision).getByRole('button', { name: 'Review Concept' })); expect(screen.getByRole('dialog')).toBeTruthy(); await userEvent.keyboard('{Escape}')
    await userEvent.click(within(decision).getByRole('button', { name: 'Retry answer' })); await solveDecision()
    expect(screen.getByText(/archive lights blinked/)).toBeTruthy(); expect(within(decision).getByText(/A routing table tells/)).toBeTruthy()
  })
  it('prevents a locked chapter from being selected even if a change event bypasses the disabled option', async () => {
    await read(); fireEvent.change(screen.getByLabelText('Choose an unlocked chapter'), { target: { value: '1' } })
    expect(screen.getByRole('heading', { name: 'The Quiet Archive' })).toBeTruthy(); expect(screen.queryByRole('heading', { name: 'A Message Home' })).toBeNull()
  })
  it('offers chapter-end hint/retry, preserves an incomplete gate, and allows a keyboard answer', async () => {
    await read(justReadArc); const quiz = screen.getByRole('region', { name: 'Chapter question 1' })
    await userEvent.click(within(quiz).getByRole('button', { name: 'A different monitor' })); expect(within(quiz).getByText(/Not quite/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue →' }).hasAttribute('disabled')).toBe(true)
    await userEvent.click(within(quiz).getByRole('button', { name: 'Retry answer' }))
    within(quiz).getByRole('button', { name: 'A route to the archive network' }).focus(); await userEvent.keyboard('{Enter}')
    expect(within(quiz).getByText(/Correct\./)).toBeTruthy()
  })
  it('restores valid progress, current chapter and completed checks after remounting', async () => {
    const ui = await read(); await solveDecision(); await answerQuizzes(); await userEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(progressKey(solveArc.arc_id))!).chapter).toBe(1))
    ui.unmount(); mount(`/read/${solveArc.arc_id}`); await screen.findByRole('heading', { name: 'A Message Home' })
    await userEvent.click(screen.getByRole('button', { name: '← Previous' })); expect(screen.getByRole('button', { name: 'Continue →' }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByText(/archive lights blinked/)).toBeTruthy()
  })
  it('shows Arc completion only after all checks and preserves unlocks when reading again', async () => {
    await read(); await solveDecision(); await answerQuizzes(); await userEvent.click(screen.getByRole('button', { name: 'Continue →' })); await answerQuizzes()
    await userEvent.click(screen.getByRole('button', { name: 'Finish Arc' })); expect(screen.getByRole('heading', { name: 'You finished this story arc.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Continue This Story/ }).getAttribute('href')).toBe(`/continue/${series.series_id}`)
    expect(screen.getByText('4')).toBeTruthy(); await userEvent.click(screen.getByRole('button', { name: 'Read Again' }))
    expect(screen.getByRole('heading', { name: 'The Quiet Archive' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Continue →' }).hasAttribute('disabled')).toBe(false)
  })
  it('handles unexpected Just Read Decisions without inserting mid-story questions', async () => {
    await read({ ...solveArc, preferences: justReadArc.preferences }); expect(screen.queryByRole('region', { name: 'Story decision' })).toBeNull()
    expect(screen.getByText(/question is omitted/)).toBeTruthy(); expect(screen.getByText(/archive lights blinked/)).toBeTruthy(); await answerQuizzes()
    expect(screen.getByRole('button', { name: 'Continue →' }).hasAttribute('disabled')).toBe(false)
  })
  it.each(['invalid json', JSON.stringify({ version: 1, fingerprint: 'old', chapter: 99, completed: ['fake'], finished: true })])('recovers safely from corrupt or stale progress', async saved => {
    localStorage.setItem(progressKey(solveArc.arc_id), saved); await read(); expect(screen.getByRole('button', { name: 'Continue →' }).hasAttribute('disabled')).toBe(true)
  })
  it('keeps concepts accessible and traps keyboard focus in the dialog', async () => {
    await read(); await userEvent.click(screen.getByRole('button', { name: 'View Concepts' }))
    const close = screen.getByRole('button', { name: 'Close concepts' }); expect(document.activeElement).toBe(close)
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}'); expect(document.activeElement).toBe(within(screen.getByRole('dialog')).getByRole('button', { name: /Routing Table/ }))
    await userEvent.keyboard('{Tab}'); expect(document.activeElement).toBe(close)
  })
})
describe('continuation and recovery', () => {
  it('inherits Genre/Story Style and last Arc defaults, sends only permitted fields with a new Lesson', async () => {
    mount(`/continue/${series.series_id}`); await screen.findByRole('heading', { name: series.title })
    expect(screen.queryByLabelText('Genre')).toBeNull(); expect(screen.queryByLabelText('Story Style')).toBeNull()
    expect((screen.getByLabelText('Interaction Mode') as HTMLSelectElement).value).toBe('Solve Along')
    expect((screen.getByLabelText('Story Length') as HTMLSelectElement).value).toBe('Quick')
    fetchMock.mockImplementation(input => String(input).endsWith('/api/lessons/sample') ? Promise.resolve(json({ ...lesson, lesson_id: '507f1f77bcf86cd799439014' }, 201)) : normalFetch(input))
    await userEvent.click(screen.getByRole('button', { name: 'Try a Sample Lesson' })); await screen.findByRole('heading', { name: 'Lesson ready' })
    await userEvent.clear(screen.getByLabelText(/Core Plot for this Arc/)); await userEvent.type(screen.getByLabelText(/Core Plot for this Arc/), 'A new mystery.')
    await userEvent.click(screen.getByRole('button', { name: 'Continue Story' })); await screen.findByRole('heading', { name: 'The Breach' })
    const body = JSON.parse(fetchMock.mock.calls.find(([url]) => String(url).endsWith('/continue'))![1]?.body as string)
    expect(body.lesson_id).toBe('507f1f77bcf86cd799439014'); expect(body.preferences.core_plot).toBe('A new mystery.')
    expect(body.preferences.genre).toBeUndefined(); expect(body.preferences.storytelling_style).toBeUndefined()
    expect(screen.getByText(/Arc 2 · Chapter 1/)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)[0].arc_id).toBe(nextArc.arc_id)
  })
  it('rejects reusing the previous Lesson before making a continuation request', async () => {
    mount(`/continue/${series.series_id}`); await screen.findByRole('heading', { name: series.title }); await userEvent.click(screen.getByRole('button', { name: 'Try a Sample Lesson' })); await screen.findByRole('heading', { name: 'Lesson ready' })
    await userEvent.click(screen.getByRole('button', { name: 'Continue Story' })); expect((await screen.findByRole('alert')).textContent).toContain('Choose a new lesson')
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/continue'))).toBe(false)
  })
  it('blocks duplicate continuation and handles a stale Series with an explicit reload action', async () => {
    fetchMock.mockImplementation(input => String(input).endsWith('/api/lessons/sample') ? Promise.resolve(json({ ...lesson, lesson_id: '507f1f77bcf86cd799439014' })) : normalFetch(input))
    mount(`/continue/${series.series_id}`); await screen.findByRole('heading', { name: series.title })
    await userEvent.click(screen.getByRole('button', { name: 'Try a Sample Lesson' })); await screen.findByRole('heading', { name: 'Lesson ready' })
    let finish!: (response: Response) => void
    fetchMock.mockImplementation(input => String(input).endsWith('/continue') ? new Promise(resolve => { finish = resolve }) : normalFetch(input))
    const form = screen.getByRole('button', { name: 'Continue Story' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/continue'))).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Remove selection' }).hasAttribute('disabled')).toBe(true)
    finish(json({ detail: 'Private transaction details' }, 409))
    expect((await screen.findByRole('alert')).textContent).toContain('Reload the continuation page')
    expect(screen.getByRole('button', { name: 'Retry' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Reload continuation' })).toBeTruthy()
  })
  it('does not navigate on a malformed generation success response', async () => {
    mount(); await userEvent.click(screen.getByRole('button', { name: 'Try a Sample Lesson' })); await screen.findByRole('heading', { name: 'Lesson ready' })
    fetchMock.mockImplementation(input => String(input).endsWith('/api/stories/generate') ? Promise.resolve(json({ arc_id: 'not-an-id' }, 201)) : normalFetch(input))
    await userEvent.click(screen.getByRole('button', { name: 'Create Story' }))
    expect((await screen.findByRole('alert')).textContent).toContain('incomplete response'); expect(screen.getByRole('heading', { name: 'Create your story' })).toBeTruthy()
  })
  it('preserves a finished Arc after refresh and remains usable when browser storage is disabled', async () => {
    const ui = await read(justReadArc); await answerQuizzes(); await userEvent.click(screen.getByRole('button', { name: 'Continue →' })); await answerQuizzes(); await userEvent.click(screen.getByRole('button', { name: 'Finish Arc' }))
    ui.unmount(); const completed = mount(`/read/${justReadArc.arc_id}`); await screen.findByRole('heading', { name: 'You finished this story arc.' }); completed.unmount()
    localStorage.clear(); const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage disabled') })
    try { await read(justReadArc); expect(await screen.findByText(/couldn't save it for your next visit/)).toBeTruthy(); await answerQuizzes(); expect(screen.getByRole('button', { name: 'Continue →' }).hasAttribute('disabled')).toBe(false) }
    finally { storage.mockRestore() }
  })
  it('handles missing Series and Arc without displaying backend internals', async () => {
    fetchMock.mockImplementation(input => String(input).endsWith('/api/health') ? normalFetch(input) : Promise.resolve(json({ detail: 'SECRET' }, 404)))
    const ui = mount(`/continue/${series.series_id}`); expect((await screen.findByRole('alert')).textContent).toContain('series could not be found')
    ui.unmount(); mount(`/read/${solveArc.arc_id}`); expect((await screen.findByRole('alert')).textContent).toContain('arc could not be found')
  })
  it('rejects malformed Arc responses and offers recovery', async () => {
    fetchMock.mockImplementation(input => String(input).includes('/api/arcs/') ? Promise.resolve(json({ ...solveArc, chapters: [{ title: 'Broken' }] })) : normalFetch(input))
    mount(`/read/${solveArc.arc_id}`); expect((await screen.findByRole('alert')).textContent).toContain('incomplete response'); expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
  it('handles network failure without rendering a fixture', async () => {
    fetchMock.mockImplementation(input => String(input).includes('/api/arcs/') ? Promise.reject(new TypeError('sensitive details')) : normalFetch(input))
    mount(`/read/${solveArc.arc_id}`); expect((await screen.findByRole('alert')).textContent).toContain('Check your connection'); expect(screen.queryByText('sensitive details')).toBeNull()
  })
  it('lists only locally remembered Series and drops missing references', async () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ series_id: series.series_id, arc_id: solveArc.arc_id }]))
    const ui = mount('/'); expect(await screen.findByRole('link', { name: /The Archive Network/ })).toBeTruthy()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/series/'))).toHaveLength(1)
    ui.unmount(); fetchMock.mockImplementation(input => String(input).includes('/api/series/') ? Promise.resolve(json({}, 404)) : normalFetch(input)); mount('/')
    await waitFor(() => expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toEqual([]))
  })
  it('removes a deleted Arc from local Continue Reading, without treating a network failure as deletion', async () => {
    const saved = [{ series_id: series.series_id, arc_id: solveArc.arc_id }]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(saved))
    fetchMock.mockImplementation(input => String(input).includes('/api/arcs/') ? Promise.resolve(json({}, 404)) : normalFetch(input))
    const ui = mount(`/read/${solveArc.arc_id}`); await screen.findByRole('alert')
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toEqual([])
    ui.unmount(); localStorage.setItem(HISTORY_KEY, JSON.stringify(saved))
    fetchMock.mockImplementation(input => String(input).includes('/api/arcs/') ? Promise.reject(new TypeError('offline')) : normalFetch(input))
    mount(`/read/${solveArc.arc_id}`); await screen.findByRole('alert')
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toEqual(saved)
  })
})
