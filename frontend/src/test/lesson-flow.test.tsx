import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import type { LessonMetadata } from '../types/lesson'

const lesson: LessonMetadata = {
  lesson_id: '507f1f77bcf86cd799439011', title: 'Introduction to Computer Networks',
  filename: 'networks.pdf', source: 'pdf', file_size_bytes: 2048,
  page_count: 2, character_count: 1200, status: 'ready', created_at: '2026-10-01T00:00:00Z',
}
const health = { status: 'degraded', database: 'not_configured', ai: 'not_configured', message: 'Set MONGODB_URI in backend/.env.' }
const fetchMock = vi.fn<typeof fetch>()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async input => String(input).endsWith('/api/health') ? json(health) : json(lesson, 201))
})

function mount(route = '/create') {
  return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)
}

describe('Phase 1 lesson interactions', () => {
  it('shows the real configuration state and saves a sample before reporting ready', async () => {
    mount()
    expect(await screen.findByText('Backend online · Database not configured')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Try a Sample Lesson/ }))
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeTruthy()
    expect(screen.getByText(lesson.lesson_id)).toBeTruthy()
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/api/lessons/sample') && options?.method === 'POST')).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Remove selection' }))
    expect(screen.queryByRole('heading', { name: 'Lesson ready' })).toBeNull()
  })

  it('sends a real File as multipart and navigates to saved page text', async () => {
    mount()
    const file = new File(['%PDF-test'], 'networks.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Choose a PDF lesson'), { target: { files: [file] } })
    await screen.findByRole('heading', { name: 'Lesson ready' })
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/lessons/upload'))!
    expect((call[1]?.body as FormData).get('file')).toBe(file)
    fetchMock.mockImplementation(async input => String(input).endsWith('/api/health') ? json(health) : json({ ...lesson, pages: [{ page_number: 1, text: 'Routers forward packets.' }, { page_number: 2, text: 'Switches connect devices.' }], extracted_text: 'Routers forward packets.\n\nSwitches connect devices.' }))
    await userEvent.click(screen.getByRole('link', { name: 'View extracted text' }))
    expect(await screen.findByText('Routers forward packets.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Page 2' })).toBeTruthy()
  })

  it('rejects wrong files and oversize input without sending an upload', async () => {
    mount()
    const input = screen.getByLabelText('Choose a PDF lesson')
    fireEvent.change(input, { target: { files: [new File(['text'], 'lesson.txt', { type: 'text/plain' })] } })
    expect(await screen.findByRole('alert')).toBeTruthy()
    const large = new File(['%PDF'], 'large.pdf', { type: 'application/pdf' })
    Object.defineProperty(large, 'size', { value: 10 * 1024 * 1024 + 1 })
    fireEvent.change(input, { target: { files: [large] } })
    expect(screen.getByRole('alert').textContent).toContain('10 MB')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/lessons/'))).toBe(false)
  })

  it('handles drag and drop and blocks duplicate submissions while saving', async () => {
    mount()
    const file = new File(['%PDF'], 'networks.pdf', { type: 'application/pdf' })
    let finish!: (response: Response) => void
    fetchMock.mockImplementation(input => String(input).endsWith('/api/health') ? Promise.resolve(json(health)) : new Promise(resolve => { finish = resolve }))
    fireEvent.drop(screen.getByText('Drop your PDF here').parentElement!, { dataTransfer: { files: [file] } })
    expect(screen.getByRole('button', { name: /Try a Sample Lesson/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.drop(screen.getByText('Drop your PDF here').parentElement!, { dataTransfer: { files: [file] } })
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/lessons/upload'))).toHaveLength(1)
    finish(json(lesson, 201))
    await screen.findByRole('heading', { name: 'Lesson ready' })
  })

  it('shows a failed save as an error and permits retry', async () => {
    mount()
    fetchMock.mockImplementation(async input => String(input).endsWith('/api/health') ? json(health) : json({ detail: 'Set MONGODB_URI in backend/.env to save lessons.' }, 503))
    await userEvent.click(screen.getByRole('button', { name: /Try a Sample Lesson/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('MONGODB_URI')
    expect(screen.queryByRole('heading', { name: 'Lesson ready' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: /Try a Sample Lesson/ }).hasAttribute('disabled')).toBe(false))
  })

  it('renders unknown routes and direct lesson-route errors', async () => {
    mount('/no-such-page')
    expect(screen.getByRole('heading', { name: 'A different chapter.' })).toBeTruthy()
  })
})
