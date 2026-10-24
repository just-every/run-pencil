import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { webhooksApi, webhooksChanged, type WebhookAlert } from './webhooksApi'

/** The operator's in-app alert for response webhooks: an endpoint that was disabled, is failing, or holds undelivered events. */
export function WebhookAlerts() {
  const [alerts, setAlerts] = useState<WebhookAlert[]>([])
  useEffect(() => {
    const load = () => { void webhooksApi.alerts().then(result => setAlerts(result.alerts)).catch(() => setAlerts([])) }
    load(); window.addEventListener(webhooksChanged, load)
    return () => window.removeEventListener(webhooksChanged, load)
  }, [])
  if (!alerts.length) return null
  return <div className="webhook-alerts" role="alert" aria-label="Integration delivery alerts">{alerts.map(alert => <p className="status-note" data-tone="error" key={`${alert.endpointId}-${alert.kind}`}>{alert.message} <Link className="focus-ring" to="/app/settings">Open settings</Link></p>)}</div>
}
