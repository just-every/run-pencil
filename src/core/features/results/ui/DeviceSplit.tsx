import type { DeviceReport } from '../../reporting'
const counted = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`
export function DeviceSplit({ report }: { report: DeviceReport }) {
  const unit = report.basis === 'sessions' ? 'recorded starts' : 'filtered responses'
  return <article className="panel results-card device-card" aria-labelledby="device-title">
    <p className="eyebrow">Device split</p><h2 id="device-title" className="display">{report.basis === 'sessions' ? 'Starts by device class' : 'Responses by device class'}</h2>
    <p className="muted">{report.total} {unit} · each share is out of this total</p>
    <div className="device-list">{(['mobile','tablet','desktop','unknown'] as const).filter(device => device !== 'unknown' || report.basis === 'responses').map(device => {
      const count = report.counts[device]
      return <div className="device-row" key={device}><span className="device-name">{device}</span><strong>{count} / {report.total} · {report.total ? `${Math.round(count / report.total * 100)}%` : 'no share'}</strong><span className="device-bar"><span style={{width:`${report.total ? count / report.total * 100 : 0}%`}} /></span></div>
    })}</div>
    <p className="muted">{counted(report.unknownResponses, 'response')} {report.unknownResponses === 1 ? 'has' : 'have'} unknown device class; earlier responses are never guessed. {counted(report.importedResponses, 'imported response')} {report.importedResponses === 1 ? 'has' : 'have'} no session and {report.importedResponses === 1 ? 'is' : 'are'} left out of device shares.</p>
    <p className="muted">{counted(report.sessionsWithoutResponse, 'session')} {report.sessionsWithoutResponse === 1 ? 'has' : 'have'} no response yet (open or abandoned). {report.sessionsWithoutResponse === 1 ? 'It is' : 'They are'} separate from filtered responses; answer and device filters cannot select them.</p>
    {report.basis === 'sessions' ? <p className="muted">Share of sessions includes starts without a response and historical starts. Stored response classes are erased with their response; anonymous session counts remain.</p> : null}
  </article>
}
