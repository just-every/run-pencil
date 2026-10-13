import type { ImportReview } from './model'
import { errorPages, pagedErrors, type ErrorPage } from './row-error-pages'

export const reviewMediaType = 'application/x-pencil-review+ndjson'
type Header = { review: Omit<ImportReview, 'rowErrors'>; errorCount: number }

export function reviewStream(review: ImportReview): ReadableStream<Uint8Array> {
  function* lines() {
    const { rowErrors, ...header } = review
    yield JSON.stringify({ review: header, errorCount: rowErrors.length }) + '\n'
    for (const page of errorPages(rowErrors)) yield JSON.stringify(page) + '\n'
    yield '{"done":true}\n'
  }
  const iterator = lines(), encoder = new TextEncoder()
  return new ReadableStream({
    pull(controller) { const item = iterator.next(); if (item.done) controller.close(); else controller.enqueue(encoder.encode(item.value)) },
    cancel() { iterator.return(undefined) },
  })
}

/** Only one transport line is decoded at a time. The UI materializes the
 * requested hundred errors, with all other pages retained as integer vectors. */
export async function readReviewStream(body: ReadableStream<Uint8Array>): Promise<ImportReview> {
  const reader = body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }), store = pagedErrors()
  let pending = '', header: Header | undefined, done = false
  const line = (text: string) => {
    if (done) throw new Error('The review contains trailing data.')
    const value = JSON.parse(text)
    if (!header) {
      if (Object.keys(value).sort().join(',') !== 'errorCount,review' || !value.review || !Number.isSafeInteger(value.errorCount) || value.errorCount < 0) throw new Error('The review header is invalid.')
      header = value as Header
    } else if (value.done === true && Object.keys(value).join(',') === 'done') done = true
    else store.append(value as ErrorPage)
  }
  try {
    for (;;) {
      const next = await reader.read()
      pending += decoder.decode(next.value, { stream: !next.done })
      let end: number
      while ((end = pending.indexOf('\n')) >= 0) { line(pending.slice(0, end)); pending = pending.slice(end + 1) }
      if (next.done) break
    }
    if (pending || !header || !done || store.errors.length !== header.errorCount) throw new Error('The review did not include every diagnostic. Review the files again.')
    return { ...header.review, rowErrors: store.errors }
  } finally { await reader.cancel(); reader.releaseLock() }
}
