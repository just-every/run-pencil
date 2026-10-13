// A response CSV in the shape Typeform's results export documents: `#` (the response id), one column per question
// title, one column per option for multiple selection, the hidden field and score, Start Date (UTC), Submit Date (UTC),
// Network ID and Tags. Synthetic values only; no real account export was used.
// Usage: node typeform-documented.mjs ROWS > typeform-documented.csv
const headers = ['#', 'Your name', 'Anything else?', 'Email for follow-up', 'What did you drink?', 'Cake', 'Toast', 'Soup', 'Where did you sit?', 'Jazz', 'Folk', 'Cup size',
  'Would you come again?', 'Rate the service', 'How busy was it?', 'How likely are you to recommend us?', 'Visits this month', 'Date of visit',
  "I agree to the café's feedback terms.", 'Rank what matters', 'Phone', 'Your website', 'Upload your receipt', 'Age', 'Leave a tip', 'utm_source', 'score',
  'Start Date (UTC)', 'Submit Date (UTC)', 'Network ID', 'Tags']
const quote = value => /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
const pad = n => String(n).padStart(2, '0')
export function* typeformRows(count) {
  yield headers.map(quote).join(',')
  for (let i = 0; i < count; i++) {
    const day = 1 + (i % 28), minute = i % 60, hour = 8 + (i % 10), again = i % 4 !== 0
    yield [`tf${String(i).padStart(8, '0')}synthetic`, `Visitor ${i}`, i % 3 ? '' : `Line one, with comma\nLine two "quoted" ${i}`, `visitor${i}@example.test`,
      i % 2 ? 'Coffee' : 'Tea', i % 2 ? 'Cake' : '', i % 3 ? '' : 'Toast', '', i % 2 ? 'Window' : 'Bar', 'Jazz', i % 5 ? '' : 'Folk', i % 2 ? 'Large' : '',
      again ? '1' : '0', String(1 + (i % 5)), String(1 + (i % 5)), String(i % 11), String(i % 20), `2026-09-${pad(day)}`, '1', '', '+61 400 000 000', 'https://example.test',
      '', String(20 + (i % 50)), '', i % 2 ? 'newsletter' : '', String(i % 3), `2026-09-${pad(day)} ${pad(hour)}:${pad(minute)}:00`, `2026-09-${pad(day)} ${pad(hour)}:${pad(minute)}:42`,
      `synthetic-network-${i}`, i % 7 ? '' : 'vip'].map(quote).join(',')
  }
}
if (process.argv[1]?.endsWith('typeform-documented.mjs')) for (const line of typeformRows(Number(process.argv[2] ?? 6))) process.stdout.write(line + '\r\n')
