import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LessonPicker from './LessonPicker'
import PreferenceFields from './PreferenceFields'
import { ApiError, continueStory, generateStory } from '../services/api'
import { rememberStory } from '../services/progress'
import type { LessonMetadata } from '../types/lesson'
import { defaultPreferences, type StoryPreferences } from '../types/story'

export const AI_NOTICE = 'Lorely uses AI to transform educational material. Important information can always be compared with your original lesson.'
const messages = ['Reading your lesson…', 'Finding the important concepts…', 'Planning the story…', 'Building the narrative…', 'Preparing your chapters…']
export default function GenerationForm({ seriesId, initialPreferences = defaultPreferences, previousLessonId }: {
  seriesId?: string; initialPreferences?: StoryPreferences; previousLessonId?: string;
}) {
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<LessonMetadata | null>(null)
  const [preferences, setPreferences] = useState({ ...initialPreferences })
  const [lessonBusy, setLessonBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(0)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const submitting = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (!busy || seriesId) return; const timer = window.setInterval(() => setMessage(i => (i + 1) % messages.length), 5000); return () => window.clearInterval(timer) }, [busy, seriesId])
  async function submit() {
    if (submitting.current || lessonBusy || !lesson || stale) return
    if (lesson.lesson_id === previousLessonId) { setError('Choose a new lesson for the next arc.'); return }
    submitting.current = true; setBusy(true); setError(''); setMessage(0)
    try {
      const { genre: _genre, storytelling_style: _style, ...nextPreferences } = preferences
      const created = await (seriesId ? continueStory(seriesId, { lesson_id: lesson.lesson_id, preferences: nextPreferences }) : generateStory({ lesson_id: lesson.lesson_id, preferences }))
      rememberStory(created)
      if (mounted.current) navigate(`/read/${created.arc_id}`)
    } catch (cause) {
      if (mounted.current) { setError(cause instanceof Error ? cause.message : 'The story could not be created. Please try again.'); setStale(cause instanceof ApiError && cause.status === 409) }
    } finally { submitting.current = false; if (mounted.current) setBusy(false) }
  }
  return <form className="generation-form" onSubmit={e => { e.preventDefault(); void submit() }} aria-busy={busy}>
    <section className="form-section"><h2><span className="section-number">01</span>{seriesId ? 'Add your next lesson' : 'Upload your lesson'}</h2>
    <LessonPicker lesson={lesson} onChange={value => { setLesson(value); setError('') }} disabled={busy} onBusy={setLessonBusy} /></section>
    <section className="form-section"><h2><span className="section-number">02</span>Choose your experience</h2>
    <PreferenceFields value={preferences} onChange={setPreferences} disabled={busy} continuing={Boolean(seriesId)} /></section>
    <section className="form-section generation-action"><h2><span className="section-number">03</span>{seriesId ? 'Continue your story' : 'Create story'}</h2>
    {!lesson && <p className="small muted">Choose a lesson above to begin.</p>}
    <button className="primary-button" type="submit" disabled={!lesson || busy || lessonBusy || stale}>{busy ? (seriesId ? 'Continuing your story…' : 'Creating your story…') : error ? 'Retry' : seriesId ? 'Continue Story' : 'Create Story'}</button>
    <div role="status" aria-live="polite">{busy && <p className="busy">{seriesId ? 'Continuing your story…' : messages[message]}</p>}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {stale && <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Reload continuation</button>}
    <p className="ai-notice">{AI_NOTICE}</p></section>
  </form>
}
