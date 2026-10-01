import { useEffect, useState } from 'react'
import { getHealth } from '../services/api'
import type { Health } from '../types/lesson'

export default function HealthStatus() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  async function check() {
    setChecking(true)
    setError('')
    try { setHealth(await getHealth()) }
    catch (cause) { setHealth(null); setError(cause instanceof Error ? cause.message : 'Backend unavailable.') }
    finally { setChecking(false) }
  }
  useEffect(() => { void check() }, [])
  return <aside className="health" aria-label="Connection status">
    <div className="health-line">
      <span className={`status-dot ${health?.database === 'connected' ? 'connected' : ''}`} aria-hidden="true" />
      <span role="status">{checking ? 'Checking connection…' : health ? `Backend online · Database ${health.database.replaceAll('_', ' ')}` : 'Backend unavailable'}</span>
      <button className="text-button" onClick={() => void check()} disabled={checking}>Check again</button>
    </div>
    {(health?.database !== 'connected' || error) && <p>{error || 'Lessons and stories need a connected database. Check the backend connection before trying again.'}</p>}
  </aside>
}
