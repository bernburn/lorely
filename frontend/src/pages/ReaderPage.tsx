import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ConceptDialog from '../components/ConceptDialog'
import ConceptText from '../components/ConceptText'
import Question from '../components/Question'
import { AI_NOTICE } from '../components/GenerationForm'
import { getArc, getLesson, getSeries } from '../services/api'
import { answerQuestion, chapterComplete, decisionKey, finishArc, moveChapter, quizKey, rememberStory, requiredDecisions, restoreProgress, saveProgress, unlockedChapter, type ReadingProgress } from '../services/progress'
import type { StoryArc, StorySeries } from '../types/story'
import type { LessonDetail } from '../types/lesson'

export default function ReaderPage() {
  const { arcId = '' } = useParams()
  const [data, setData] = useState<{ arc: StoryArc; series: StorySeries; lesson: LessonDetail } | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true; setData(null); setError('')
    void getArc(arcId).then(async arc => {
      const [series, lesson] = await Promise.all([getSeries(arc.series_id), getLesson(arc.lesson_id)])
      if (!series.arc_ids.includes(arc.arc_id) || series.series_id !== arc.series_id || lesson.lesson_id !== arc.lesson_id) throw new Error('This story has incomplete source information. Please try again.')
      if (active) { rememberStory(arc); setData({ arc, series, lesson }) }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not open this story.') })
    return () => { active = false }
  }, [arcId, retry])
  if (error) return <div className="reader-empty"><p className="eyebrow">A pause in the story</p><h1>We couldn't open this arc.</h1><p className="error" role="alert">{error}</p><div className="actions"><button className="secondary-button" onClick={() => setRetry(i => i + 1)}>Try again</button><Link to="/create">Create another story</Link></div></div>
  if (!data) return <div className="reader-empty"><p className="eyebrow">Your reading room</p><p role="status">Opening your story arc…</p></div>
  return <StoryReader key={`${arcId}-${retry}`} {...data} />
}
function StoryReader({ arc, series, lesson }: { arc: StoryArc; series: StorySeries; lesson: LessonDetail }) {
  const [restored] = useState(() => restoreProgress(arc))
  const [progress, setProgress] = useState(restored.progress)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [concept, setConcept] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const closeConcept = useCallback(() => setConcept(null), [])
  useEffect(() => { setStorageAvailable(saveProgress(arc, progress)) }, [arc, progress])
  function update(action: (p: ReadingProgress) => ReadingProgress, navigate = false) {
    setProgress(p => action(p))
    if (navigate) window.setTimeout(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start' }) }, 0)
  }
  const chapter = arc.chapters[progress.chapter]
  const decisions = requiredDecisions(arc, progress.chapter)
  const decisionsDone = decisions.every(k => progress.completed.includes(k))
  const complete = chapterComplete(arc, progress, progress.chapter)
  const unexpected = arc.preferences.interaction_mode === 'Just Read' && chapter.blocks.some(b => b.type === 'decision')
  let stopped = false
  const blocks = chapter.blocks.map((block, i) => {
    if (stopped) return null
    if (block.type === 'paragraph') return <p key={i}><ConceptText text={block.text} concepts={arc.concepts} onConcept={setConcept} /></p>
    if (arc.preferences.interaction_mode === 'Just Read') return null
    const key = decisionKey(progress.chapter, i)
    const done = progress.completed.includes(key)
    if (!done) stopped = true
    return <Question key={key} question={block} prompt={block.prompt} label="Story decision" complete={done} onReview={setConcept} onAnswer={choice => update(p => answerQuestion(arc, p, key, choice))} />
  })
  const finishedChapters = arc.chapters.filter((_, i) => chapterComplete(arc, progress, i)).length
  return <article className="reader">
    <div className="reader-topline"><Link to="/">← Home</Link><button className="text-button" onClick={() => setConcept('')}>View Concepts</button></div>
    <div className="reading-progress" role="progressbar" aria-label="Chapters completed" aria-valuemin={0} aria-valuemax={arc.chapters.length} aria-valuenow={finishedChapters}><span style={{ width: `${finishedChapters / arc.chapters.length * 100}%` }} /></div>
    {restored.recovered && <p className="small muted" role="status">Some saved progress was out of date. Your available chapters have been restored safely.</p>}
    {!storageAvailable && <p className="small muted" role="status">Reading progress is available for this visit. This browser couldn't save it for your next visit.</p>}
    <header className="reader-heading"><p className="series-title">{series.title}</p><p className="reader-meta">Arc {arc.arc_number}{!progress.finished && ` · Chapter ${chapter.chapterNumber}`} · {arc.preferences.genre} · {arc.preferences.storytelling_style} · {arc.preferences.education_level}</p>
    <h1 ref={heading} tabIndex={-1}>{progress.finished ? 'You finished this story arc.' : chapter.title}</h1><p className="source-credit">Based on: <Link to={`/lessons/${lesson.lesson_id}`}>{lesson.title}</Link></p>
    {!progress.finished && <details className="arc-summary"><summary>About this arc · {arc.title}</summary><p>{arc.summary}</p></details>}</header>
    {progress.finished ? <section className="arc-completion"><p>The story can continue with your next lesson.</p><dl className="completion-facts"><div><dt>Concepts explored</dt><dd>{arc.concepts.map(c => c.term).join(', ')}</dd></div><div><dt>Questions completed</dt><dd>{progress.completed.length}</dd></div><div><dt>Source Lesson</dt><dd><Link to={`/lessons/${lesson.lesson_id}`}>{lesson.title}</Link></dd></div></dl>
    <div className="completion-actions"><Link className="primary-button" to={`/continue/${series.series_id}`}>Continue This Story →</Link><Link className="secondary-button" to="/create">Create Another Story</Link><button className="text-button" onClick={() => update(p => moveChapter(arc, p, 0), true)}>Read Again</button></div></section> : <>
      {unexpected && <p className="small muted" role="status">This arc includes a story decision outside Just Read mode. Its question is omitted so you can read uninterrupted; the chapter-end checks remain required.</p>}
      <div className="story-prose">{blocks}</div>
      {decisionsDone && <section className="chapter-check" aria-labelledby="check-heading"><p className="eyebrow">A moment to reflect</p><h2 id="check-heading">Check Your Understanding</h2><p className="muted small">Answer each question to {progress.chapter === arc.chapters.length - 1 ? 'finish this arc' : 'continue to the next chapter'}.</p>
      {chapter.endQuiz.map((question, i) => { const key = quizKey(progress.chapter, i); return <Question key={key} question={question} prompt={question.question} label={`Chapter question ${i + 1}`} complete={progress.completed.includes(key)} onReview={setConcept} onAnswer={choice => update(p => answerQuestion(arc, p, key, choice))} /> })}</section>}
      <nav className="chapter-navigation" aria-label="Chapter navigation"><button className="text-button" disabled={progress.chapter === 0} onClick={() => update(p => moveChapter(arc, p, p.chapter - 1), true)}>← Previous</button>
      <label><span className="visually-hidden">Choose an unlocked chapter</span><select aria-label="Choose an unlocked chapter" value={progress.chapter} onChange={e => update(p => moveChapter(arc, p, Number(e.target.value)), true)}>{arc.chapters.map((c, i) => <option key={i} value={i} disabled={i > unlockedChapter(arc, progress)}>Chapter {c.chapterNumber} of {arc.chapters.length}{i > unlockedChapter(arc, progress) ? ' · Locked' : ''}</option>)}</select></label>
      <button className="primary-button" disabled={!complete} onClick={() => update(p => progress.chapter === arc.chapters.length - 1 ? finishArc(arc, p) : moveChapter(arc, p, p.chapter + 1), true)}>{progress.chapter === arc.chapters.length - 1 ? 'Finish Arc' : 'Continue →'}</button></nav>
      {!complete && <p className="navigation-hint small muted">{decisionsDone ? 'Complete every chapter question to unlock what comes next.' : 'Complete the story decision to read on.'}</p>}
    </>}
    <p className="ai-notice">{AI_NOTICE}</p>
    {concept !== null && <ConceptDialog concepts={arc.concepts} selected={concept} onSelect={setConcept} onClose={closeConcept} />}
  </article>
}
