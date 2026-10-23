import type { DeviceReport } from '../../reporting'
export function DeviceSplit({ report }: { report: DeviceReport }) {
  const unit = report.basis === 'sessions' ? 'recorded starts' : 'filtered native responses'
  return <article className="panel results-card device-card" aria-labelledby="device-title">
    <p className="eyebrow">Device split</p><h2 id="device-title" className="display">{report.basis === 'sessions' ? 'Starts by device class' : 'Responses by device class'}</h2>
    <p className="muted">{report.total} {unit} · each share uses this denominator</p>
    <div className="device-list">{(['mobile','tablet','desktop','unknown'] as const).filter(device => device !== 'unknown' || report.basis === 'responses').map(device => {
      const count = report.counts[device]
      return <div className="device-row" key={device}><span className="device-name">{device}</span><strong>{count} / {report.total} · {report.total ? Math.round(count / report.total * 100) : 0}%</strong><span className="device-bar"><span style={{width:`${report.total ? count / report.total * 100 : 0}%`}} /></span></div>
    })}</div>
    <p className="muted">{report.unknownResponses} native responses have unknown device class; earlier responses are never guessed. {report.importedResponses} imported responses have no native session and are excluded from device shares.</p>
    <p className="muted">{report.sessionsWithoutResponse} sessions have not produced a response (open or recorded as abandoned), across the selected revision scope. These unlinked sessions are separate from filtered responses; answer and device filters cannot select them.</p>
    {report.basis === 'sessions' ? <p className="muted">Share of sessions includes starts without a response and historical starts. Stored response classes are erased with their response; anonymous session counts remain.</p> : null}
  </article>
}
