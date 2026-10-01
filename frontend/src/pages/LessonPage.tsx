import { useRef, useState } from 'react'
import { Check, FileText, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { uploadLesson, useSampleLesson } from '../services/api'
import type { LessonMetadata } from '../types/lesson'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function LessonPage() {
  const input = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [lesson, setLesson] = useState<LessonMetadata | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function submit(file?: File) {
    if (submitting.current) return
    setError('')
    if (file && (!file.name.toLowerCase().endsWith('.pdf') || (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type)))) {
      setError('Choose a PDF file with selectable text.'); return
    }
    if (file && file.size > MAX_FILE_SIZE) { setError('This PDF is too large. The maximum file size is 10 MB.'); return }
    submitting.current = true
    setBusy(file ? 'Uploading and reading your lesson…' : 'Saving the sample lesson…')
    try { setLesson(await (file ? uploadLesson(file) : useSampleLesson())) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The lesson could not be saved.') }
    finally { setBusy(''); submitting.current = false }
  }

  function remove() { setLesson(null); setError(''); if (input.current) input.current.value = '' }

  return <>
    <p className="eyebrow">A place to begin</p>
    <h1>Bring your lesson.</h1>
    <p className="intro">Upload a school module or explore a sample. We’ll read its text and save your lesson for what comes next.</p>
    <section className="lesson-flow" aria-labelledby="upload-heading" aria-busy={Boolean(busy)}>
      <h2 id="upload-heading">Upload a lesson</h2>
      <input ref={input} className="visually-hidden" type="file" accept=".pdf,application/pdf" aria-label="Choose a PDF lesson" disabled={Boolean(busy)}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void submit(file) }} />
      <div className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault(); setDragging(false)
          if (busy) return
          if (event.dataTransfer.files.length !== 1) { setError('Choose one PDF at a time.'); return }
          void submit(event.dataTransfer.files[0])
        }}>
        <Upload size={28} strokeWidth={1.5} aria-hidden="true" />
        <p>Drop your PDF here</p>
        <button className="primary-button" disabled={Boolean(busy)} onClick={() => input.current?.click()}>{lesson ? 'Change PDF' : 'Choose a PDF'}</button>
        <span className="muted small">Selectable text · Up to 10 MB · 80 pages</span>
      </div>
      <p className="privacy">The original PDF is not permanently stored. Extracted lesson text is stored in MongoDB.</p>
      <div className="sample-row">
        <div><span className="eyebrow">Or start here</span><h3>Introduction to Computer Networks</h3><p className="muted small">Packets, IP addresses, routers, routing tables, and switches.</p></div>
        <button className="secondary-button" onClick={() => void submit()} disabled={Boolean(busy)}><FileText size={17} aria-hidden="true" />Try a Sample Lesson</button>
      </div>
      <div aria-live="polite" role="status">{busy && <p className="busy">{busy}</p>}</div>
      {error && <p className="error" role="alert">{error}</p>}
      {lesson && <section className="ready" aria-labelledby="ready-heading">
        <h2 id="ready-heading"><Check size={20} aria-hidden="true" />Lesson ready</h2>
        <h3>{lesson.title}</h3>
        <p className="muted small">{lesson.filename} · {lesson.page_count} {lesson.source === 'sample' ? 'sections' : 'pages'} · {lesson.character_count.toLocaleString()} characters{lesson.file_size_bytes !== null ? ` · ${(lesson.file_size_bytes / 1024).toFixed(1)} KB` : ''}</p>
        <p className="small">Saved to MongoDB. Lesson ID: <code>{lesson.lesson_id}</code></p>
        <div className="actions"><Link className="secondary-button" to={`/lessons/${lesson.lesson_id}`}>View extracted text</Link><button className="text-button" onClick={remove} disabled={Boolean(busy)}>Remove selection</button></div>
        <p className="muted small">Story creation is coming in the next phase. Removing this selection does not delete the saved lesson.</p>
      </section>}
    </section>
  </>
}
