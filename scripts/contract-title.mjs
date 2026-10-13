import ts from 'typescript'

const unknown = Symbol('unresolved title value')
const unwrap = node => ts.isAsExpression(node) || ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node

function value(node, bindings) {
  if (!node) return unknown
  node = unwrap(node)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isIdentifier(node)) return bindings.has(node.text) ? bindings.get(node.text) : unknown
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = value(node.operand, bindings)
    return operand === unknown ? unknown : !operand
  }
  if (ts.isConditionalExpression(node)) {
    const condition = value(node.condition, bindings)
    return condition === unknown ? unknown : value(condition ? node.whenTrue : node.whenFalse, bindings)
  }
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text
    for (const span of node.templateSpans) {
      const part = value(span.expression, bindings)
      if (part === unknown) return unknown
      text += String(part) + span.literal.text
    }
    return text
  }
  return unknown
}

export function contractTitle(node, bindings) {
  const result = value(node, bindings)
  return typeof result === 'string' ? result : undefined
}

// Interpret only finite literal cases; never execute authored test code or
// substitute a wildcard for an unresolved title.
export function literalContractLoop(node, bindings) {
  if (!ts.isForOfStatement(node) || !ts.isVariableDeclarationList(node.initializer)
    || !(node.initializer.flags & ts.NodeFlags.Const) || node.initializer.declarations.length !== 1) return undefined
  const name = node.initializer.declarations[0].name, expression = unwrap(node.expression)
  if (!ts.isIdentifier(name) || !ts.isArrayLiteralExpression(expression)) return undefined
  const values = expression.elements.map(element => value(element, bindings))
  return values.every(item => item !== unknown) ? { name: name.text, values } : undefined
}
