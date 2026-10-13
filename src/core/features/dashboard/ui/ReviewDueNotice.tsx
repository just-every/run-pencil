import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'

/** ACT-005: a passed review date is surfaced here and on the Actions page; nothing else happens. */
export function ReviewDueNotice() {
  const [due, setDue] = useState(0)
  useEffect(() => {
    let active = true
    fetch('/api/app/actions', { credentials: 'same-origin' }).then(response => response.ok ? response.json() as Promise<{ actions: Array<{ reviewDue: boolean }> }> : { actions: [] })
      .then(result => { if (active) setDue(result.actions.filter(action => action.reviewDue).length) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  if (!due) return null
  return <p className="status-note" role="status"><span className="badge" data-status="review-due">Review due</span> {due === 1 ? '1 action has' : `${due} actions have`} reached the review date. <Link className="focus-ring" to="/app/actions">Open actions</Link></p>
}
