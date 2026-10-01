import { Link, Route, Routes } from 'react-router-dom'
import HealthStatus from './components/HealthStatus'
import LessonDetailPage from './pages/LessonDetailPage'
import LessonPage from './pages/LessonPage'

export default function App() {
  return <div className="app-shell">
    <header><Link className="wordmark" to="/">Lorely<span aria-hidden="true">.</span></Link><nav aria-label="Main navigation"><Link to="/create">Add a lesson</Link></nav></header>
    <main><Routes>
      <Route path="/" element={<LessonPage />} />
      <Route path="/create" element={<LessonPage />} />
      <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
      <Route path="*" element={<><p className="eyebrow">Page not found</p><h1>A different chapter.</h1><p>This page isn’t available. Start with a lesson.</p><Link className="primary-button" to="/create">Add a lesson</Link></>} />
    </Routes><HealthStatus /></main>
    <footer>Lorely · Foundation &amp; lessons</footer>
  </div>
}
