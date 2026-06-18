import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log("DATABASE_URL not set — skipping migrations.")
    process.exit(0)
  }

  const pool = new Pool({ connectionString: url })
  const db = drizzle(pool)

  console.log("Running migrations…")
  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("Migrations complete.")

  await pool.end()
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
