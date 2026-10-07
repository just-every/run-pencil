export type D1BatchStatement = {
  readonly sql: string
  readonly parameters: readonly unknown[]
}

export type D1BatchResult = {
  readonly changes: number
}

/**
 * The narrow transactional-write capability feature repositories need from D1.
 * It keeps Cloudflare's binding API inside the platform boundary.
 */
export interface D1BatchExecutor {
  execute(statements: readonly D1BatchStatement[]): Promise<readonly D1BatchResult[]>
}

export function createD1BatchExecutor(binding: D1Database): D1BatchExecutor {
  return {
    async execute(statements) {
      const results = await binding.batch(statements.map((statement) => binding.prepare(statement.sql).bind(...statement.parameters)))
      return results.map((result) => ({ changes: result.meta.changes }))
    },
  }
}
