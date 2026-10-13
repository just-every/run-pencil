import { useCallback, useState } from 'react'
import { firstAnswer, type AnswerId } from './answers'

export interface AnswerPath {
  /** The circled answer. */
  readonly chosen: AnswerId
  /** The answer whose circle and follow-up are being rubbed out, after the visitor chose another. */
  readonly erased: AnswerId | null
  /** Counts choices; 0 is the server-rendered card, which never animates. Keys restart each choice's animations. */
  readonly turn: number
}

/** The visitor's path through the note card: choosing a different answer erases the last one and circles the new one. */
export function useAnswerPath() {
  const [path, setPath] = useState<AnswerPath>({ chosen: firstAnswer, erased: null, turn: 0 })
  const choose = useCallback((id: AnswerId) => {
    setPath(current => current.chosen === id ? current : { chosen: id, erased: current.chosen, turn: current.turn + 1 })
  }, [])
  return { ...path, choose }
}
