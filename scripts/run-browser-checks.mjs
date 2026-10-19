import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { browserShards as shards } from './verification-lanes.mjs'
// Each viewport runs the complete native suite in freshly migrated runtimes.
// Production auth limits remain unchanged; sessions/rate ledgers never get
// reset inside a journey. Local sign-in links share one loopback allowance of
// 30 per 15 minutes, so each viewport's journeys run in isolated shards, each with
// its own runtime and empty ledgers. Browser evidence retains every outcome.
const [output, selectedProject, selectedShard] = process.argv.slice(2)
if ((selectedProject || selectedShard) && (!['desktop', 'mobile'].includes(selectedProject) || !Number.isInteger(Number(selectedShard)) || Number(selectedShard) < 1 || Number(selectedShard) > shards)) {
  throw new Error(`A browser lane requires desktop or mobile and shard 1 through ${shards}.`)
}
const projects = selectedProject ? [selectedProject] : ['desktop', 'mobile']
const selectedShards = selectedShard ? [Number(selectedShard)] : Array.from({ length: shards }, (_, index) => index + 1)
const directory = await mkdtemp(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-browser-projects-'))
const reports = []
let failed = false
try {
  for (const project of projects) for (const shard of selectedShards) {
    const file = join(directory,`${project}-${shard}.json`)
    const code = await new Promise((resolve,reject) => {
      const child = spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',`--project=${project}`,`--shard=${shard}/${shards}`,`--output=test-results/${project}-${shard}`,'--reporter=json'], {
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME:file }, stdio:['ignore','inherit','inherit'],
      })
      child.once('error',reject);child.once('close',resolve)
    })
    const report = JSON.parse(await readFile(file,'utf8'))
    reports.push(report)
    console.log(`${project} shard ${shard}/${shards}: ${report.stats.expected} passed, ${report.stats.unexpected} failed, ${report.stats.skipped} skipped`)
    if (code !== 0) failed = true
  }
  const report = { ...reports[0], suites: reports.flatMap(item=>item.suites), errors: reports.flatMap(item=>item.errors ?? []), stats: {
    startTime:reports[0].stats.startTime,
    ...Object.fromEntries(['duration','expected','skipped','unexpected','flaky'].map(key=>[key,reports.reduce((sum,item)=>sum+(item.stats[key]??0),0)])),
  } }
  if (output) await writeFile(output,JSON.stringify(report))
  if (failed) process.exitCode=1
} finally { await rm(directory,{recursive:true,force:true}) }
