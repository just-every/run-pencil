#!/usr/bin/env node
// Preserve the legacy document layout while deriving touched clauses from CONTRACT.md.
import fs from 'node:fs'
import { parseContract } from '../src/base/seed-contract.mjs'

const [mode, ...ids] = process.argv.slice(2)
if (!['write', 'check'].includes(mode)) throw new Error('Use contract-docs.mjs write or check followed by the touched clause IDs.')
const read = file => fs.readFileSync(file, 'utf8')
let contract = read('CONTRACT.md')
const statusRows = [...contract.matchAll(/^\| `([^`]+)` \|.*$/gm)].map(match => match[0].split(/(?<!\\)\|/).slice(1, -1).map(cell => cell.trim()))
const tally = rows => ['done', 'partial', 'missing'].map(status => rows.filter(row => row[3] === status).length).concat(rows.length)
const summary = [
  ['Published', statusRows.filter(row => row[2] === 'published')],
  ['Target and push further', statusRows.filter(row => row[2] !== 'published')],
  ['All', statusRows],
]
const lines = contract.split('\n')
const start = lines.findIndex(line => /^\| Clauses \| Done \| Partial \| Missing \| Total \|$/.test(line))
if (start < 0) throw new Error('CONTRACT.md has no Status summary table.')
for (let index = start + 2; lines[index]?.startsWith('|'); index++) {
  const label = lines[index].split('|')[1].trim()
  const selected = summary.find(([name]) => name === label || label === 'All clauses' && name === 'All')
  if (!selected) throw new Error('Unknown Status summary category: ' + label)
  lines[index] = `| ${label} | ${tally(selected[1]).join(' | ')} |`
}
contract = lines.join('\n')
const parsed = parseContract(contract)
const selected = ids.map(id => {
  const clause = parsed.clauses.find(clause => clause.id === id)
  if (!clause) throw new Error('Unknown touched clause: ' + id)
  return clause
})
let acceptance = read('ACCEPTANCE.md'), claims = read('CLAIMS.md')
for (const clause of selected) {
  const description = clause.text.replace(/\s*\*Status:[\s\S]*$/, '').trim()
  const evidence = statusRows.find(row => row[0] === '`' + clause.id + '`')[4]
  const entry = `- ${clause.id} — ${clause.title} — ${clause.status}. ${description} Evidence: ${evidence}.${clause.gap ? ' Remaining: ' + clause.gap : ''}`
  const existing = new RegExp(`^- ${clause.id} —.*$`, 'm')
  if (!existing.test(acceptance)) throw new Error('Missing acceptance entry: ' + clause.id)
  acceptance = acceptance.replace(existing, () => entry)
  const row = `| ${clause.id} | ${clause.status} | ${evidence} | ${clause.gap} |`
  const claim = new RegExp(`^\\| ${clause.id} \\|.*$`, 'm')
  claims = claim.test(claims) ? claims.replace(claim, () => row) : claims.trimEnd() + '\n' + row + '\n'
}
const published = tally(summary[0][1]), target = tally(statusRows.filter(row => row[2] !== 'published')), all = tally(statusRows)
acceptance = acceptance.replace(/Its \d+ release-wall clauses have \d+ done, \d+ partial and \d+ missing Status rows/, `Its ${published[3]} release-wall clauses have ${published[0]} done, ${published[1]} partial and ${published[2]} missing Status rows`)
  .replace(/Its \d+ target and push-further clauses \(\d+ done, \d+ partial, \d+ missing\)/, `Its ${target[3]} target and push-further clauses (${target[0]} done, ${target[1]} partial, ${target[2]} missing)`)
  .replace(/Across all \d+ clauses, \d+ are done, \d+ partial and \d+ missing/, `Across all ${all[3]} clauses, ${all[0]} are done, ${all[1]} partial and ${all[2]} missing`)
const view = '# Pencil implementation claims\n\n<!-- Generated from CONTRACT.md. -->\n\n| Clause | Status | Evidence | Remaining scope |\n| --- | --- | --- | --- |\n' + statusRows.map(row => `| ${row[0]} | ${row[3]} | ${row[4]} | ${row[5]} |`).join('\n') + '\n'
for (const [file, text] of [['CONTRACT.md', contract], ['ACCEPTANCE.md', acceptance], ['CLAIMS.md', claims], ['docs/CLAIMS.md', view]]) {
  if (mode === 'write') { fs.mkdirSync(file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.', { recursive: true }); fs.writeFileSync(file, text) }
  else if (!fs.existsSync(file) || read(file) !== text) throw new Error(file + ' is stale; regenerate the touched clauses.')
}
console.log('Contract views ' + (mode === 'write' ? 'regenerated' : 'fresh') + (ids.length ? ': ' + ids.join(', ') : '.'))
