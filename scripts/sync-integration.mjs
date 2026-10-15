import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { deploymentSpec } from './delivery/base/spec.mjs'
import { loadSetupManifest } from './delivery/base/setup-manifest.mjs'

const mode = process.argv[2]
if (process.argv.length !== 3 || !['--check', '--write'].includes(mode)) {
  throw new Error('Use --check or --write after pnpm build:delivery')
}
const root = resolve(import.meta.dirname, '..')
const config = JSON.parse(await readFile(new URL('./delivery/base/packaging.json', import.meta.url)))
const spec = await deploymentSpec(root, config.artifact.specInputs)
const setup = await loadSetupManifest(root, config.setup)
const projectFile = resolve(root, 'rer-project.json')
const project = JSON.parse(await readFile(projectFile, 'utf8'))
const binding = { path: setup.path, sha256: setup.sha256 }
if (mode === '--write') {
  await writeFile(projectFile, JSON.stringify({ ...project, setup: binding }, null, 2) + '\n')
} else if (project.setup?.path !== binding.path || project.setup?.sha256 !== binding.sha256) {
  throw new Error('Stale project setup binding; regenerate with pnpm integration:sync')
}
const directory = resolve(root, 'management/integration')
const file = resolve(directory, 'deployment-spec.json')
const bytes = JSON.stringify(spec, null, 2) + '\n'
if (mode === '--write') {
  await mkdir(directory, { recursive: true })
  await writeFile(file, bytes)
} else if (await readFile(file, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return ''
  throw error
}) !== bytes) {
  throw new Error('Stale integration deployment spec; regenerate with pnpm integration:sync')
}
console.log('Integration deployment spec and setup binding match the Base build readers.')
