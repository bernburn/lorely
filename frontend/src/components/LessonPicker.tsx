import { useEffect, useRef, useState } from 'react'
import { Check, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { uploadLesson, useSampleLesson } from '../services/api'
import type { LessonMetadata } from '../types/lesson'

export default function LessonPicker({ lesson, onChange, disabled = false, onBusy }: {
  lesson: LessonMetadata | null; onChange: (lesson: LessonMetadata | null) => void; disabled?: boolean; onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const mounted = useRef(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function submit(file?: File) {
    if (disabled || submitting.current) return
    setError('')
    if (file && (!file.name.toLowerCase().endsWith('.pdf') || (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type)))) { setError('Choose a PDF file with selectable text.'); return }
    if (file && file.size > 10 * 1024 * 1024) { setError('This PDF is too large. The maximum file size is 10 MB.'); return }
    submitting.current = true; onBusy(true)
    setBusy(file ? 'Uploading and reading your lesson…' : 'Saving the sample lesson…')
    try { const saved = await (file ? uploadLesson(file) : useSampleLesson()); if (mounted.current) onChange(saved) }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'The lesson could not be saved.') }
    finally { submitting.current = false; if (mounted.current) { setBusy(''); onBusy(false) } }
  }
  const locked = disabled || Boolean(busy)
  return <div aria-busy={Boolean(busy)}>
    <input ref={input} className="visually-hidden" type="file" accept=".pdf,application/pdf" aria-label="Choose a PDF lesson" disabled={locked}
      onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void submit(file) }} />
    {lesson ? <section className="ready" aria-labelledby="ready-heading">
      <div><h3 id="ready-heading"><Check size={18} aria-hidden="true" />Lesson ready</h3><p className="lesson-title">{lesson.title}</p>
      <p className="muted small">{lesson.filename} · {lesson.page_count} {lesson.source === 'sample' ? 'sections' : 'pages'}{lesson.file_size_bytes !== null ? ` · ${(lesson.file_size_bytes / 1024).toFixed(1)} KB` : ''}</p></div>
      <div className="actions"><button className="secondary-button" type="button" disabled={locked} onClick={() => input.current?.click()}>Change PDF</button>
      <button className="text-button" type="button" disabled={locked} onClick={() => { onChange(null); setError('') }}>Remove selection</button></div>
      <details className="lesson-details"><summary>Saved lesson details</summary><p className="small">Reference: <code>{lesson.lesson_id}</code></p><Link to={`/lessons/${lesson.lesson_id}`}>View extracted text</Link></details>
    </section> : <>
      <div className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); if (!locked) setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (locked) return; if (e.dataTransfer.files.length !== 1) { setError('Choose one PDF at a time.'); return }; void submit(e.dataTransfer.files[0]) }}>
        <Upload size={24} strokeWidth={1.5} aria-hidden="true" /><p>Drop your PDF here</p>
        <button className="secondary-button" type="button" disabled={locked} onClick={() => input.current?.click()}>Choose a PDF</button>
        <span className="muted small">Selectable text · Up to 10 MB · 80 pages</span>
      </div>
      <div className="sample-row"><div><h3>Introduction to Computer Networks</h3><p className="muted small">No file handy? Start with packets, routers, and switches.</p></div>
      <button className="text-button" type="button" onClick={() => void submit()} disabled={locked}>Try a Sample Lesson</button></div>
    </>}
    <p className="privacy">The original uploaded PDF file is not permanently stored. Extracted lesson text is saved for your story.</p>
    <div role="status" aria-live="polite">{busy && <p className="busy">{busy}</p>}</div>
    {error && <p className="error" role="alert">{error}</p>}
  </div>
}
