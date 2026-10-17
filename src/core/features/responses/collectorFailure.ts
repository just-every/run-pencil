import { CollectorClosedError } from '../collectors'

export function collectorFlowFailure(error: unknown, flow: { title: string; slug: string }): never {
  if (error instanceof CollectorClosedError) throw new CollectorClosedError({ ...flow, collectionClosed: true })
  throw error
}
