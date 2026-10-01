import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson } from '../services/api'
import type { LessonDetail } from '../types/lesson'

export default function LessonDetailPage() {
  const { lessonId } = useParams()
  const [lesson, setLesson] = useState<LessonDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLesson(null); setError('')
    void getLesson(lessonId!).then(result => { if (active) setLesson(result) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load lesson.') })
    return () => { active = false }
  }, [lessonId])
  return <>
    <Link className="back-link" to="/create">← Choose another lesson</Link>
    {error ? <p role="alert" className="error">{error}</p> : !lesson ? <p role="status">Loading lesson…</p> : <>
      <p className="eyebrow">Extracted lesson</p><h1>{lesson.title}</h1>
      <p className="muted">{lesson.page_count} {lesson.source === 'sample' ? 'sections' : 'pages'} · {lesson.character_count.toLocaleString()} characters · Saved to MongoDB</p>
      <p className="small">Lesson ID: <code>{lesson.lesson_id}</code></p>
      {lesson.pages.map(page => <section className="source-page" key={page.page_number}>
        <h2>{lesson.source === 'sample' ? 'Section' : 'Page'} {page.page_number}</h2>
        <p className="source-text">{page.text || 'No selectable text on this page.'}</p>
      </section>)}
    </>}
  </>
}
