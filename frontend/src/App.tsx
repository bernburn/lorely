import { useEffect, useRef } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import HealthStatus from './components/HealthStatus'
import LessonDetailPage from './pages/LessonDetailPage'
import LessonPage from './pages/LessonPage'
import LandingPage from './pages/LandingPage'
import ReaderPage from './pages/ReaderPage'
import ContinuePage from './pages/ContinuePage'

export default function App() {
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)
  useEffect(() => {
    window.scrollTo(0, 0)
    if (previousPath.current !== pathname) document.getElementById('main-content')?.focus()
    previousPath.current = pathname
  }, [pathname])
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header"><Link className="wordmark" to="/">Lorely<span aria-hidden="true">.</span></Link><nav aria-label="Main navigation"><Link to="/create">Create</Link></nav></header>
    <main id="main-content" tabIndex={-1}><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<LessonPage />} />
      <Route path="/read/:arcId" element={<ReaderPage />} />
      <Route path="/continue/:seriesId" element={<ContinuePage />} />
      <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
      <Route path="*" element={<><p className="eyebrow">Page not found</p><h1>A different chapter.</h1><p className="intro">This page isn't available. A new story can start with your next lesson.</p><Link className="primary-button" to="/create">Create a story</Link></>} />
    </Routes></main>
    <footer><span>Lorely · A different way to learn.</span><HealthStatus /></footer>
  </div>
}
