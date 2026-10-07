/** Find a complete ordering with allowed ranks, excluding earlier equality rules.
 * A perfect matching check prunes impossible rank assignments. At most the
 * number of excluded orderings plus one complete ordering needs inspection.
 */
export function priorityIsPossible(choices: string[], allowedRanks: number[][], excluded: string[][]): boolean {
  const ranks = new Map<number, number>()
  const canComplete = (remaining: number[], used: Set<number>) => {
    const owner = new Map<number, number>()
    const assign = (choice: number, seen: Set<number>): boolean => {
      for (const rank of allowedRanks[choice]) {
        if (used.has(rank) || seen.has(rank)) continue
        seen.add(rank)
        const previous = owner.get(rank)
        if (previous === undefined || assign(previous, seen)) {
          owner.set(rank, choice)
          return true
        }
      }
      return false
    }
    return remaining.every((choice) => assign(choice, new Set()))
  }
  const search = (remaining: number[], used: Set<number>): boolean => {
    if (remaining.length === 0) return !excluded.some((ordering) => choices.every((choice, index) => ordering[ranks.get(index)! - 1] === choice))
    if (!canComplete(remaining, used)) return false
    const next = remaining.reduce((best, choice) => allowedRanks[choice].filter((rank) => !used.has(rank)).length < allowedRanks[best].filter((rank) => !used.has(rank)).length ? choice : best)
    for (const rank of allowedRanks[next]) {
      if (used.has(rank)) continue
      ranks.set(next, rank)
      if (search(remaining.filter((choice) => choice !== next), new Set(used).add(rank))) return true
      ranks.delete(next)
    }
    return false
  }
  return search(choices.map((_, index) => index), new Set())
}
