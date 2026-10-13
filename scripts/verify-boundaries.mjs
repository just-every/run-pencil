import { readFile, readdir } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve(new URL('..', import.meta.url).pathname)
const compilerOptions = ts.parseJsonConfigFileContent(JSON.parse(await readFile(resolve(root, 'tsconfig.app.json'), 'utf8')), ts.sys, root).options

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : []
  }))
  return nested.flat()
}

function resolveSpecifier(specifier, sourceFile) {
  return ts.resolveModuleName(specifier, sourceFile, compilerOptions, ts.sys).resolvedModule?.resolvedFileName
}

function featureName(path) {
  return relative(resolve(root, 'src/core/features'), path).split('/')[0]
}

function isString(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

const errors = []
const files = await sourceFiles(resolve(root, 'src'))
for (const file of files) {
  const shown = relative(root, file)
  // Complete upstream packages retain their own framework/runtime test harnesses.
  // Application boundaries cover their runtime source, not those unbundled tests.
  if (/^src\/base\/(?:mail|operator-auth)\/(?:tests|oidc\/tests|conformance)\//.test(shown)) continue
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const inspectSpecifier = (specifier) => {
    if (specifier.startsWith('cloudflare:') && !shown.startsWith('src/core/platform/')) {
      errors.push(`${shown} imports ${specifier} outside src/core/platform`)
    }
    const target = resolveSpecifier(specifier, file)
    if (!target) return
    const targetShown = relative(root, target)
    if (shown.startsWith('src/ext/') && targetShown.startsWith('src/core/') && !targetShown.startsWith('src/core/api/') && !targetShown.startsWith('src/core/shared/')) {
      errors.push(`${shown} imports outside core/api or core/shared: ${specifier}`)
    }
    if (shown.startsWith('src/core/') && targetShown.startsWith('src/ext/') && !['src/core/app/mountExtensions.client.ts', 'src/core/app/mountExtensions.server.ts'].includes(shown)) {
      errors.push(`${shown} imports buyer extension code outside an extension mount: ${specifier}`)
    }
    if (shown.startsWith('src/ext/index.client.') && /(?:server|repository|service)\.[cm]?[jt]sx?$/.test(targetShown)) {
      errors.push(`${shown} imports server code: ${specifier}`)
    }
    if (shown.startsWith('src/core/features/') && targetShown.startsWith('src/core/features/')) {
      const sourceFeature = featureName(file)
      const targetFeature = featureName(target)
      if (sourceFeature !== targetFeature && !targetShown.endsWith('/index.ts')) {
        errors.push(`${shown} deep-imports ${targetShown}; features expose cross-feature APIs only from index.ts`)
      }
    }
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && isString(node.moduleSpecifier)) inspectSpecifier(node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (!isString(node.arguments[0])) errors.push(`${shown} has a non-literal dynamic import`)
      else inspectSpecifier(node.arguments[0].text)
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'eval') errors.push(`${shown} uses runtime code evaluation`)
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') errors.push(`${shown} uses runtime code evaluation`)
    const environmentRead = ts.isPropertyAccessExpression(node)
      && (node.name.text === 'env' || (ts.isIdentifier(node.expression) && ['env', 'environment'].includes(node.expression.text)))
    if (shown.startsWith('src/core/') && environmentRead && !shown.startsWith('src/core/platform/')) {
      errors.push(`${shown} reads an environment binding outside src/core/platform`)
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
}

for (const path of ['src/ext/config.ts', ...files.filter((file) => relative(root, file).startsWith('src/ext/local/')).map((file) => relative(root, file))]) {
  const body = await readFile(resolve(root, path), 'utf8')
  if (!body.startsWith('/**')) errors.push(`${path} needs a buyer-owned header comment and worked example`)
}

if (errors.length > 0) {
  console.error(`Boundary validation failed with ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log(`Boundary validation passed for ${files.length} source files.`)
