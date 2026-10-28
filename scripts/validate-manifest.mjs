import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { parseContract } from '../src/base/seed-contract.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const clausePattern = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}$/
const extensionPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.v\d+$/
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

async function readJson(path) {
  try {
    return JSON.parse(await readFile(resolve(root, path), 'utf8'))
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`)
  }
}

async function validateAgainstBundledSchema(schema, path) {
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['scripts/schema/validate.mjs', '--schema', schema, path], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolveResult({ code, output }))
  })
  if (result.code !== 0) throw new Error(result.output.trim())
}

async function clauseIds(path) {
  const document = await readFile(resolve(root, path), 'utf8')
  return [...document.matchAll(/^- \*\*([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})\s+—/gm)].map((match) => match[1])
}

function requireValue(errors, subject, value) {
  if (value === undefined || value === null || value === '') errors.push(`${subject} is required`)
}

const errors = []
const seed = await readJson('seed.json')
try {
  await validateAgainstBundledSchema('SEED', 'seed.json')
} catch (error) {
  errors.push(`seed.json does not validate against the bundled base SEED schema: ${error.message}`)
}
const [contract, baseline] = await Promise.all([clauseIds('CONTRACT.md'), clauseIds('BASELINE.md')])
const targetContract = parseContract(await readFile(resolve(root, 'CONTRACT.md'), 'utf8'))
const declaredClauses = new Set([...targetContract.clauses.map(clause => clause.id), ...baseline])

for (const key of ['id', 'name', 'version', 'maturity', 'description', 'capabilities', 'nonGoals', 'externals', 'env', 'deploy', 'extensionPoints', 'limits', 'accessibility', 'operatingCost']) {
  requireValue(errors, `seed.json.${key}`, seed[key])
}
if (!semverPattern.test(seed.version ?? '')) errors.push('seed.json.version must be semver')

const capabilityClauses = new Set()
for (const capability of seed.capabilities ?? []) {
  requireValue(errors, 'each capability.id', capability?.id)
  if (!Array.isArray(capability?.clauses) || capability.clauses.length === 0) {
    errors.push(`capability ${capability?.id ?? '<unknown>'} needs at least one clause`)
    continue
  }
  for (const id of capability.clauses) {
    if (!clausePattern.test(id)) errors.push(`capability ${capability.id} has invalid clause ID ${JSON.stringify(id)}`)
    else if (!declaredClauses.has(id)) errors.push(`capability ${capability.id} references undeclared clause ${id}`)
    else capabilityClauses.add(id)
  }
}
for (const id of contract) {
  if (!capabilityClauses.has(id)) errors.push(`CONTRACT clause ${id} is not declared by any seed capability`)
}

const publicPaths = seed.deploy?.publicPaths
if (!Array.isArray(publicPaths) || publicPaths.length === 0) {
  errors.push('seed.json.deploy.publicPaths must be a non-empty array')
} else {
  for (const path of publicPaths) {
    if (typeof path !== 'string' || !path.startsWith('/')) errors.push(`invalid public path ${JSON.stringify(path)}`)
  }
  if (!publicPaths.includes('/')) errors.push('seed.json.deploy.publicPaths must declare the literal public root /')
  if (!publicPaths.includes(seed.deploy?.healthPath)) errors.push('seed.json.deploy.healthPath must also be public')
}

for (const entry of seed.env ?? []) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(entry?.name ?? '')) errors.push(`invalid environment variable ${JSON.stringify(entry?.name)}`)
  if (typeof entry?.required !== 'boolean') errors.push(`environment variable ${entry?.name ?? '<unknown>'} must state required`)
  if (typeof entry?.secret !== 'boolean') errors.push(`environment variable ${entry?.name ?? '<unknown>'} must state secret`)
  requireValue(errors, `environment variable ${entry?.name ?? '<unknown>'}.why`, entry?.why)
}

const extensionIds = new Set()
for (const [kind, ids] of Object.entries(seed.extensionPoints ?? {})) {
  if (!Array.isArray(ids)) {
    errors.push(`extensionPoints.${kind} must be an array`)
    continue
  }
  for (const id of ids) {
    if (!extensionPattern.test(id)) errors.push(`extensionPoints.${kind} has invalid ID ${JSON.stringify(id)}`)
    if (extensionIds.has(id)) errors.push(`extension point ${id} appears more than once`)
    extensionIds.add(id)
  }
}

try {
  const release = await readJson('RELEASE.json')
  try {
    await validateAgainstBundledSchema('RELEASE', 'RELEASE.json')
  } catch (error) {
    errors.push(`RELEASE.json does not validate against the bundled base RELEASE schema: ${error.message}`)
  }
  for (const key of ['version', 'contractChanges', 'extensionPointChanges', 'migrations', 'breaking', 'agentUpdateInstructions']) {
    requireValue(errors, `RELEASE.json.${key}`, release[key])
  }
  if (release.version !== seed.version) errors.push('RELEASE.json.version must equal seed.json.version')
  if (!Array.isArray(release.migrations)) errors.push('RELEASE.json.migrations must be an array')
  if (!Array.isArray(release.extensionPointChanges)) errors.push('RELEASE.json.extensionPointChanges must be an array')
  if (typeof release.breaking !== 'boolean') errors.push('RELEASE.json.breaking must be boolean')
} catch (error) {
  if (!error.message.startsWith('RELEASE.json is not valid JSON: ENOENT')) throw error
  console.log('RELEASE.json is absent: release-candidate validation is deferred.')
}

if (errors.length > 0) {
  console.error(`Manifest validation failed with ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Manifest is internally consistent: ${contract.length} product clauses, ${baseline.length} baseline clauses, ${extensionIds.size} extension IDs.`)
