import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { ReportFigures } from '../core/features/results/ui/ReportFigures'
import { loadSharedReport } from '../core/features/results/ui/sharedReportLoader'
import type { SharedReport } from '../core/features/reporting/savedModel'
import '../core/features/results/ui/crosstab.css'

export const Route = createFileRoute('/reports/$token')({
  loader: ({ params }) => loadSharedReport({ data: { token: params.token } }),
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] }),
  notFoundComponent: () => <main className="shared-report-shell"><h1 className="display">Report not found</h1><p>This report link is unavailable.</p></main>,
  component: SharedReportPage,
})
function SharedReportPage() {
  const initial = Route.useLoaderData(), { token } = Route.useParams()
  const [report, setReport] = useState<SharedReport | undefined>('passwordRequired' in initial ? undefined : initial)
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const unlock = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch(`/api/public/reports/${token}`, { method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!response.ok) throw new Error(response.status === 404 ? 'This report link is unavailable.' : 'That password did not open the report.')
      setReport(await response.json() as SharedReport); setPassword('')
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  return <main className="shared-report-shell pencil-canvas"><h1 className="display">Shared report</h1>
    {report ? <ReportFigures report={report} /> : <form className="report-form" onSubmit={unlock}><label className="inspector-field">Report password<input className="text-input" autoComplete="current-password" required type="password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="primary-button focus-ring" type="submit" disabled={busy}>Open report</button></form>}
    {error ? <p role="alert">{error}</p> : null}
  </main>
}
