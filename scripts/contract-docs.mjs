#!/usr/bin/env node
import fs from 'node:fs'
import { parseContract } from '../src/base/seed-contract.mjs'

const [command, ...ids] = process.argv.slice(2)
if (!['write', 'check'].includes(command) || !ids.length) throw new Error('Usage: node scripts/contract-docs.mjs write|check <touched clause IDs>')
const original = fs.readFileSync('CONTRACT.md', 'utf8')
const lines = original.split('\n')
const start = lines.findIndex(line => line === '| Clauses | Done | Partial | Missing | Total |')
if (start < 0) throw new Error('The contract needs its Status summary table.')
let end = start + 2
while (lines[end]?.startsWith('|')) end++
const withoutSummary = [...lines.slice(0, start), ...lines.slice(end)].join('\n')
const parsed = parseContract(withoutSummary)
for (const id of ids) if (!parsed.clauses.some(clause => clause.id === id)) throw new Error(`Unknown touched clause ${id}`)
const tally = selected => ({ done: selected.filter(clause => clause.status === 'done').length, partial: selected.filter(clause => clause.status === 'partial').length, missing: selected.filter(clause => clause.status === 'missing').length, total: selected.length })
const groups = [['Published', parsed.clauses.filter(clause => clause.kind === 'published')], ['Target and push further', parsed.clauses.filter(clause => clause.kind !== 'published')], ['All', parsed.clauses]]
const summary = groups.map(([name, clauses]) => { const count = tally(clauses); return `| ${name} | ${count.done} | ${count.partial} | ${count.missing} | ${count.total} |` })
const contract = [...lines.slice(0, start + 2), ...summary, ...lines.slice(end)].join('\n')
parseContract(contract)
let acceptance = fs.readFileSync('ACCEPTANCE.md', 'utf8')
for (const id of ids) {
  const clause = parsed.clauses.find(item => item.id === id)
  const row = contract.split('\n').find(line => line.startsWith(`| \`${id}\` |`)).split('|').map(cell => cell.trim())
  const content = `- ${id} — ${clause.title} — ${clause.status}. ${clause.text} Evidence: ${row[5] || 'None.'} Gap: ${row[6] || 'None.'}`
  const entry = acceptance.split('\n').find(line => line.startsWith(`- ${id} —`))
  if (!entry) throw new Error(`ACCEPTANCE.md lacks ${id}`)
  acceptance = acceptance.replace(entry, content)
}
const published = tally(groups[0][1]), target = tally(groups[1][1]), all = parsed.counts
acceptance = acceptance.replace(/Its \d+ release-wall clauses have \d+ done, \d+ partial and \d+ missing Status rows/, `Its ${published.total} release-wall clauses have ${published.done} done, ${published.partial} partial and ${published.missing} missing Status rows`)
acceptance = acceptance.replace(/Its \d+ target and push-further clauses \(\d+ done, \d+ partial, \d+ missing\)/, `Its ${target.total} target and push-further clauses (${target.done} done, ${target.partial} partial, ${target.missing} missing)`)
acceptance = acceptance.replace(/Across all \d+ clauses, \d+ are done, \d+ partial and \d+ missing/, `Across all ${all.total} clauses, ${all.done} are done, ${all.partial} partial and ${all.missing} missing`)
const files = { 'CONTRACT.md': contract, 'ACCEPTANCE.md': acceptance, 'docs/CLAIMS.md': '<!-- Generated from CONTRACT.md. -->\n# Pencil homepage claims\n\nNo homepage claims are mapped in CONTRACT.md. Clause statuses and evidence are recorded in ACCEPTANCE.md.\n' }
for (const [name, content] of Object.entries(files)) {
  if (command === 'check') { if (!fs.existsSync(name) || fs.readFileSync(name, 'utf8') !== content) throw new Error(`${name} is stale; run contract-docs write with the touched clause IDs.`) }
  else { fs.mkdirSync(name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '.', { recursive: true }); fs.writeFileSync(name, content) }
}
console.log(command === 'check' ? 'Contract documents are current.' : 'Contract documents regenerated for ' + ids.join(', ') + '.')
