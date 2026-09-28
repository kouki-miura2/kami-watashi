// Test-only: fresh, in-memory local D1 and R2 (the same workerd simulation `wrangler dev` uses),
// with every migration in `migrations/` applied to D1. Imported by DAO tests only.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { getPlatformProxy, unstable_splitSqlQuery } from 'wrangler'

const packageRoot = join(import.meta.dirname, '..', '..')
const migrationsDir = join(packageRoot, 'migrations')

export const createTestD1 = async () => {
  const proxy = await getPlatformProxy<{ DB: D1Database; IMAGES: R2Bucket }>({
    configPath: join(packageRoot, 'wrangler.jsonc'),
    persist: false,
  })
  const db = proxy.env.DB

  const migrations = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of migrations) {
    const statements = unstable_splitSqlQuery(readFileSync(join(migrationsDir, file), 'utf8'))
    await db.batch(statements.map((statement) => db.prepare(statement)))
  }

  return { db, images: proxy.env.IMAGES, dispose: proxy.dispose }
}
