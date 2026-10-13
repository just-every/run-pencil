import { canonicalChunks } from '../../../base/import-kit/src/provenance/canonical-stream'
import type { ImportReview } from './model'

/** Preserve every report value without retaining the entire expanded JSON. */
export function reviewResponse(review: ImportReview): ReadableStream<Uint8Array> {
  const chunks = canonicalChunks(review), encoder = new TextEncoder()
  return new ReadableStream({
    pull(controller) {
      const chunk = chunks.next()
      if (chunk.done) controller.close()
      else controller.enqueue(encoder.encode(chunk.value))
    },
    cancel() { chunks.return(undefined) },
  })
}
