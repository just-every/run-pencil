import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const candidate = await command('git', ['rev-parse', 'HEAD'], root)
if (candidate.code !== 0) throw new Error(candidate.output.trim())
const candidateCommit = candidate.output.trim()

function command(file, args, cwd) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(file, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolveResult({ code, output }))
  })
}

const temporary = await mkdtemp(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-clean-clone-'))
const checkout = join(temporary, 'seed')
console.log(`Checking clean clone at ${candidateCommit}.`)
try {
  for (const [file, args, cwd] of [
    ['git', ['clone', '--no-local', root, checkout], root],
    ['git', ['rev-parse', 'HEAD'], checkout],
    ['pnpm', ['install', '--frozen-lockfile'], checkout],
    ['pnpm', ['verify'], checkout],
    ['pnpm', ['source:check'], checkout],
    ['pnpm', ['verify:publication'], checkout],
    ['pnpm', ['build'], checkout],
  ]) {
    const result = await command(file, args, cwd)
    if (result.code !== 0) {
      console.error(`${file} ${args.join(' ')} failed in the clean clone:\n${result.output.trim()}`)
      process.exitCode = 1
      if (file === 'git' || args[0] === 'install') break
      continue
    }
    console.log(`${file} ${args.join(' ')}: exit 0`)
    if (file === 'git' && args[0] === 'rev-parse' && result.output.trim() !== candidateCommit) {
      console.error(`Clean clone resolved ${result.output.trim()}, not candidate ${candidateCommit}.`)
      process.exitCode = 1
      break
    }
  }
  if (!process.exitCode) console.log(`Clean clone at ${candidateCommit} retained release history, installed, and passed pnpm verify.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
