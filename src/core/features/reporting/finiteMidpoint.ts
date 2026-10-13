/** Sum first to preserve subnormals; split only when finite operands overflow. */
export function finiteMidpoint(a: number, b: number) {
  if (a === b) return a
  const sum = a+b
  return Number.isFinite(sum) ? sum/2 : a/2+b/2
}
