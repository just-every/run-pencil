/** A screen's name in a select: its question alone, shortened at a word to what the select can show whole. */
export function nextScreenLabel(prompt: string, phone: boolean) {
  const limit = phone ? 36 : 52
  const text = prompt.trim().replace(/\s+/g, ' ')
  if (text.length <= limit) return text
  const cut = text.slice(0, limit - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 12)).trimEnd()}…`
}
