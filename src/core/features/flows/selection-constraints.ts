/** Exact satisfiability for selected-choice clauses and a selection-count interval.
 * Literals use one-based choice indexes; negative literals mean unselected.
 * Unit/count propagation avoids enumerating all subsets of up to 100 choices.
 */
export function selectionIsPossible(count: number, clauses: number[][], min: number, max: number): boolean {
  const search = (assigned: Map<number, boolean>): boolean => {
    let remaining: number[][] = []
    while (true) {
      const selected = [...assigned.values()].filter(Boolean).length
      const unknown = count - assigned.size
      if (selected > max || selected + unknown < min) return false
      remaining = []
      for (const clause of clauses) {
        if (clause.some((literal) => assigned.get(Math.abs(literal)) === (literal > 0))) continue
        const unresolved = clause.filter((literal) => !assigned.has(Math.abs(literal)))
        if (unresolved.length === 0) return false
        remaining.push(unresolved)
      }
      const forced = remaining.find((clause) => clause.length === 1)?.[0]
      if (forced !== undefined) {
        assigned.set(Math.abs(forced), forced > 0)
      } else if (unknown > 0 && (selected === max || selected + unknown === min)) {
        for (let choice = 1; choice <= count; choice++) if (!assigned.has(choice)) assigned.set(choice, selected !== max)
      } else break
    }
    // Unconstrained choices can fill any remaining count in the interval.
    if (remaining.length === 0) return true
    const literal = remaining.reduce((shortest, clause) => clause.length < shortest.length ? clause : shortest)[0]
    return search(new Map(assigned).set(Math.abs(literal), literal > 0))
      || search(new Map(assigned).set(Math.abs(literal), literal < 0))
  }
  return search(new Map())
}
