import { readFile, writeFile } from 'node:fs/promises'
import { parseContract } from '../src/base/seed-contract.mjs'

// The held Base pin predates contract-docs. Adopt touched legacy entries while
// retaining every other recorded journey and the existing contract format.
const [mode, ...ids] = process.argv.slice(2)
if (!['write', 'check'].includes(mode) || !ids.length) throw Error('Use write or check followed by changed clause IDs.')
const read = path => readFile(path, 'utf8')
const source = await read('CONTRACT.md')
const cells = line => line.slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim())
const rows = source.split('\n').filter(line => /^\| `[^`]+` \|/.test(line)).map(cells)
const tally = rows => ['done', 'partial', 'missing'].map(status => rows.filter(row => row[3] === status).length).concat(rows.length)
const contract = source.replace(/^\| (Published|Target and push further|All) \|.*$/gm, (_, label) => {
  const selected = rows.filter(row => label === 'All' || (label === 'Published' ? row[2] === 'published' : row[2] !== 'published'))
  return `| ${label} | ${tally(selected).join(' | ')} |`
})
const model = parseContract(contract), lines = contract.split('\n')
let acceptance = await read('ACCEPTANCE.md')
for (const id of ids) {
  const clause = model.clauses.find(row => row.id === id)
  if (!clause) throw Error('Unknown clause: ' + id)
  const entries = acceptance.split('\n'), index = entries.findIndex(line => line.startsWith(`- ${id} — `))
  if (index < 0) throw Error('Missing legacy acceptance journey: ' + id)
  const boundary = entries[index].search(/ (?:Evidence|Gap): /)
  let journey = (boundary < 0 ? entries[index] : entries[index].slice(0, boundary))
    .replace(/ — (?:done|partial|missing)\./, ` — ${clause.status}.`)
  const explicit = /\*Acceptance:\* ([\s\S]*?) \*Status: ([\s\S]*?)\*\s*$/.exec(clause.text)
  if (explicit) journey = `- ${id} — ${clause.title} — ${clause.status}. Acceptance: ${explicit[1]} Today: ${explicit[2].replace(/^(?:done|partial|missing)\s*(?:—\s*)?/, '')}`
  const row = cells(lines[clause.row - 1])
  entries[index] = `${journey} Evidence: ${row[4]}` + (row[5] ? ` Gap: ${row[5]}` : '')
  acceptance = entries.join('\n')
}
const [publishedDone, publishedPartial, publishedMissing, publishedTotal] = tally(rows.filter(row => row[2] === 'published'))
const [targetDone, targetPartial, targetMissing, targetTotal] = tally(rows.filter(row => row[2] !== 'published'))
acceptance = acceptance
  .replace(/Its \d+ release-wall clauses have \d+ done, \d+ partial and \d+ missing Status rows/, `Its ${publishedTotal} release-wall clauses have ${publishedDone} done, ${publishedPartial} partial and ${publishedMissing} missing Status rows`)
  .replace(/Its \d+ target and push-further clauses \(\d+ done, \d+ partial, \d+ missing\)/, `Its ${targetTotal} target and push-further clauses (${targetDone} done, ${targetPartial} partial, ${targetMissing} missing)`)
  .replace(/Across all \d+ clauses, \d+ are done, \d+ partial and \d+ missing\./, `Across all ${model.counts.total} clauses, ${model.counts.done} are done, ${model.counts.partial} partial and ${model.counts.missing} missing.`)
const claims = ['# Implementation claims', '',
  '<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->', '',
  'Acceptance journeys and remaining obligations are recorded in CONTRACT.md and ACCEPTANCE.md.', '',
  '| Clause | Title | Kind | Status | Evidence paths |', '| --- | --- | --- | --- | --- |',
  ...model.clauses.map(clause => `| ${clause.id} | ${clause.title} | ${clause.kind} | ${clause.status} | ${clause.evidence.map(path => '`' + path + '`').join('; ')} |`), '',
].join('\n')
for (const [path, expected] of [['CONTRACT.md', contract], ['ACCEPTANCE.md', acceptance], ['docs/CLAIMS.md', claims]]) {
  if (mode === 'write') await writeFile(path, expected)
  else if (await read(path) !== expected) throw Error(path + ' differs from CONTRACT.md; run the matching write command')
}
console.log(`Contract documents ${mode}: ${ids.join(', ')}; ${model.counts.done} done, ${model.counts.partial} partial, ${model.counts.missing} missing.`)
