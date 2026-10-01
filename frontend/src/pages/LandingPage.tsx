import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getSeries } from '../services/api'
import { forgetStory, knownStories } from '../services/progress'
import { AI_NOTICE } from '../components/GenerationForm'
export default function LandingPage() {
  const [recent, setRecent] = useState<{ title: string; arcId: string; seriesId: string }[]>([])
  useEffect(() => {
    let active = true
    void Promise.all(knownStories().slice(0, 3).map(async saved => {
      try {
        const series = await getSeries(saved.series_id)
        return { title: series.title, seriesId: series.series_id, arcId: series.arc_ids.includes(saved.arc_id) ? saved.arc_id : series.arc_ids[series.arc_ids.length - 1] }
      } catch (error) { if (error instanceof ApiError && error.status === 404) forgetStory(saved.series_id); return null }
    })).then(items => { if (active) setRecent(items.filter(item => item !== null)) })
    return () => { active = false }
  }, [])
  return <div className="landing">
    <section className="hero"><p className="eyebrow">Same lesson. A new way in.</p><h1>Turn your lessons<br className="desktop-break" /> into stories.</h1>
    <p className="intro">Upload a school module and transform the same concepts into a story built around how you like to read.</p>
    <div className="actions"><Link className="primary-button" to="/create">Transform a Lesson <span aria-hidden="true">→</span></Link><a className="text-button" href="#example">See an Example</a></div></section>
    <ol className="how-it-works">{[['Upload', 'Your lesson'], ['Personalize', 'Your experience'], ['Read', 'And learn']].map(([title, subtitle], i) => <li key={title}><span className="step-index">0{i + 1}</span><div><h2>{title}</h2><p>{subtitle}</p></div></li>)}</ol>
    <section id="example" className="example" aria-labelledby="example-heading"><p className="eyebrow">A glimpse of the idea</p><h2 id="example-heading">The concept stays. The experience changes.</h2>
    <div className="example-grid"><div><h3>Original</h3><p>A router forwards packets between networks.</p></div><div><h3>Story</h3><blockquote>Mira opened the router's routing table to discover why the packet couldn't reach the archive network.</blockquote></div></div>
    <p className="small muted">An illustrative excerpt. Your story will be created from your own lesson.</p></section>
    {recent.length > 0 && <section className="recent"><h2>Continue Reading</h2>{recent.map(story => <Link key={story.seriesId} className="recent-link" to={`/read/${story.arcId}`}><span>{story.title}</span><span aria-hidden="true">→</span></Link>)}<p className="small muted">Remembered in this browser.</p></section>}
    <p className="ai-notice">{AI_NOTICE}</p>
  </div>
}
