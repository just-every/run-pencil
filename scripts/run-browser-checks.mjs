import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
// Each viewport runs the complete native suite in its own freshly migrated
// runtime. Production auth limits remain unchanged; sessions/rate ledgers never
// get reset inside a journey. Browser evidence retains both project outcomes.
const output = process.argv[2]
const directory = await mkdtemp(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-browser-projects-'))
const reports = []
let failed = false
try {
  for (const project of ['desktop','mobile']) {
    const file = join(directory,`${project}.json`)
    const code = await new Promise((resolve,reject) => {
      const child = spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',`--project=${project}`,`--output=test-results/${project}`,'--reporter=json'], {
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME:file }, stdio:['ignore','inherit','inherit'],
      })
      child.once('error',reject);child.once('close',resolve)
    })
    const report = JSON.parse(await readFile(file,'utf8'))
    reports.push(report)
    console.log(`${project}: ${report.stats.expected} passed, ${report.stats.unexpected} failed, ${report.stats.skipped} skipped`)
    if (code !== 0) failed = true
  }
  const report = { ...reports[0], suites: reports.flatMap(item=>item.suites), errors: reports.flatMap(item=>item.errors ?? []), stats: {
    startTime:reports[0].stats.startTime,
    ...Object.fromEntries(['duration','expected','skipped','unexpected','flaky'].map(key=>[key,reports.reduce((sum,item)=>sum+(item.stats[key]??0),0)])),
  } }
  if (output) await writeFile(output,JSON.stringify(report))
  if (failed) process.exitCode=1
} finally { await rm(directory,{recursive:true,force:true}) }
