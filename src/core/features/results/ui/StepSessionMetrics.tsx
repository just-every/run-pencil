export function StepSessionMetrics({ reached, dropped, answered }: { reached: number; dropped: number; answered: number }) {
  if (reached < answered || dropped > reached || answered + dropped > reached || reached < 0 || dropped < 0) return <p className="status-note" data-tone="error" role="alert">Session reach and drop-off are unavailable: retained counters contradict the saved response evidence. Historical session details may already have expired.</p>
  return <p className="muted">{reached} distinct sessions reached · {dropped} expired sessions ended here · {reached ? `${Math.round(dropped / reached * 100)}%` : 'No rate'} drop-off ({dropped} / {reached} reached sessions)</p>
}
