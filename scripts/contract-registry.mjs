import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { parseContract, clauseIdSource } from '../src/base/seed-contract.mjs'
import { contractTitle, literalContractLoop } from './contract-title.mjs'

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : collectTestFiles(path)
    return /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : []
  }))
  return files.flat()
}

function stringArgument(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined
}

export async function contractRegistry(root) {
  const files = (await Promise.all(['tests', 'src'].map((directory) => collectTestFiles(resolve(root, directory))))).flat()
  const registry = new Map()

  for (const file of files) {
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node, bindings = new Map()) => {
      const loop = literalContractLoop(node, bindings)
      if (loop) {
        for (const value of loop.values) visit(node.statement, new Map([...bindings, [loop.name, value]]))
        return
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'contract') {
        const argument = node.arguments[0]
        const ids = ts.isArrayLiteralExpression(argument) ? argument.elements.map(stringArgument) : [stringArgument(argument)]
        if (ids.length && ids.every(Boolean)) {
          const name = contractTitle(node.arguments[1], bindings)
          for (const id of ids) {
            const entry = registry.get(id) ?? { covered: [], todo: [] }
            entry.covered.push({ file, title: name ? `[${ids.join(',')}] ${name}` : undefined, browser: file.startsWith(resolve(root, 'tests/e2e')) })
            registry.set(id, entry)
          }
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'contract' && node.expression.name.text === 'todo') {
        const id = stringArgument(node.arguments[0])
        if (id) {
          const entry = registry.get(id) ?? { covered: [], todo: [] }
          entry.todo.push(file)
          registry.set(id, entry)
        }
      }
      ts.forEachChild(node, child => visit(child, bindings))
    }
    ts.forEachChild(source, visit)
  }
  return registry
}

// Product clauses are read by the same parser as /contract and rer check.
export async function readProductContract(root) {
  return parseContract(await readFile(resolve(root, 'CONTRACT.md'), 'utf8'), { file: 'CONTRACT.md' })
}

export async function readBaselineClauses(root) {
  const text = await readFile(resolve(root, 'BASELINE.md'), 'utf8')
  return [...text.matchAll(new RegExp('^-\\s+\\*\\*(' + clauseIdSource + ')\\s+[—–-]\\s+(.+?)\\*\\*', 'gm'))]
    .map(match => ({ id: match[1], title: match[2].replace(/[.:]$/, '') }))
}
