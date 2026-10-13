import { useEffect, useRef, useState } from 'react'
import { importsApi, type Job } from './api'
/** Each response is durable progress. Stop on a failure or after the current
 * request when paused/unmounted; continuing later uses the stored job only. */
export function useImportProgress(publish: (job: Job) => void) {
  const stopped = useRef(false), mounted = useRef(true)
  const [active, setActive] = useState<string>()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stopped.current = true } }, [])
  const follow = async (initial: Job) => {
    stopped.current = false
    let job = initial
    if (!mounted.current) return
    setActive(job.id); publish(job)
    try {
      while (!stopped.current && !['completed', 'undone', 'rolled_back', 'cancelled', 'preparation-interrupted'].includes(job.state)) {
        job = await importsApi.resume(job.id)
        if (mounted.current) publish(job)
      }
    } finally { if (mounted.current) setActive(undefined) }
  }
  return { active, follow, show: (job: Job) => { if (mounted.current) publish(job) }, pause: () => { stopped.current = true } }
}
