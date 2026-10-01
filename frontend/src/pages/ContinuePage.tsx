import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GenerationForm from '../components/GenerationForm'
import { getArc, getSeries } from '../services/api'
import type { StoryArc, StorySeries } from '../types/story'
export default function ContinuePage() {
  const { seriesId = '' } = useParams()
  const [data, setData] = useState<{ series: StorySeries; arc: StoryArc } | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true; setData(null); setError('')
    void getSeries(seriesId).then(async series => {
      const arc = await getArc(series.arc_ids[series.arc_ids.length - 1])
      if (arc.series_id !== series.series_id || arc.preferences.genre !== series.genre || arc.preferences.storytelling_style !== series.storytelling_style) throw new Error('This story has incomplete continuation information. Please try again.')
      if (active) setData({ series, arc })
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load this series.') })
    return () => { active = false }
  }, [seriesId, retry])
  return <><p className="eyebrow">The next arc</p><h1>Continue your story</h1>
    {error ? <div><p className="error" role="alert">{error}</p><div className="actions"><button className="secondary-button" onClick={() => setRetry(i => i + 1)}>Try again</button><Link to="/create">Create another story</Link></div></div> : !data ? <p role="status">Opening your story series…</p> : <>
      <section className="series-context" aria-label="Your story series"><h2>{data.series.title}</h2><p className="muted">{data.series.arc_ids.length} {data.series.arc_ids.length === 1 ? 'arc' : 'arcs'} · {data.series.genre} · {data.series.storytelling_style}</p>
      <p className="small muted">Genre and Story Style carry forward with this world. Choose a new lesson for its next chapter.</p><Link className="small" to={`/read/${data.arc.arc_id}`}>Return to the latest arc →</Link></section>
      <GenerationForm key={`${seriesId}-${retry}`} seriesId={seriesId} previousLessonId={data.arc.lesson_id} initialPreferences={data.arc.preferences} />
    </>}</>
}
