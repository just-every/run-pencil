/** Stored references are revision data, never arbitrary URLs or embed markup. */
export type QuestionVideo = { provider: 'youtube' | 'vimeo'; reference: string }

export function questionVideoValid(value: unknown): value is QuestionVideo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const video = value as Record<string, unknown>
  if (Object.keys(video).length !== 2 || typeof video.reference !== 'string') return false
  return video.provider === 'youtube' ? /^[A-Za-z0-9_-]{11}$/.test(video.reference)
    : video.provider === 'vimeo' && /^[1-9][0-9]{0,11}$/.test(video.reference)
}

/** Only public HTTPS watch links; query values never reach the player. */
export function questionVideoFromUrl(value: string): QuestionVideo | undefined {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return
    let video: QuestionVideo | undefined
    if (['youtube.com', 'www.youtube.com'].includes(url.hostname) && url.pathname === '/watch'
      && [...url.searchParams.keys()].every(key => key === 'v') && url.searchParams.getAll('v').length === 1) {
      video = { provider: 'youtube', reference: url.searchParams.get('v')! }
    } else if (url.hostname === 'youtu.be' && !url.search) {
      video = { provider: 'youtube', reference: url.pathname.slice(1) }
    } else if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname) && !url.search) {
      video = { provider: 'vimeo', reference: url.pathname.slice(1) }
    }
    return questionVideoValid(video) ? video : undefined
  } catch { return undefined }
}

export function questionVideoUrl(video: QuestionVideo) {
  return video.provider === 'youtube' ? `https://www.youtube.com/watch?v=${video.reference}` : `https://vimeo.com/${video.reference}`
}

export function questionVideoEmbed(video: QuestionVideo) {
  return video.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${video.reference}?autoplay=1`
    : `https://player.vimeo.com/video/${video.reference}?dnt=1&autoplay=1`
}

type VideoStep = { id: string; kind: string; questionSettings?: Record<string, unknown> | null }

/** Validate the complete proposed graph before saving or publishing media. */
export function questionVideoIssues(steps: VideoStep[]) {
  const grouped = new Set(steps.flatMap(step => {
    const screen = step.questionSettings?.screen as { questionIds?: unknown } | undefined
    return Array.isArray(screen?.questionIds) ? screen.questionIds.filter((id): id is string => typeof id === 'string') : []
  }))
  return steps.flatMap(step => {
    const video = step.questionSettings?.video
    if (video === undefined) return []
    const reason = !questionVideoValid(video) ? 'Choose a valid YouTube or Vimeo video reference.'
      : step.kind !== 'question' || step.questionSettings?.screen !== undefined || grouped.has(step.id)
        ? 'Video is supported on standalone questions only. Remove the video before combining questions.' : undefined
    return reason ? [{ stepId: step.id, reason }] : []
  })
}
