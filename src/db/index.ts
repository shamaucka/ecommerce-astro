import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

// Ensure .env is loaded
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../../.env") })

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error("[DB] DATABASE_URL not set!")
  throw new Error("DATABASE_URL is required")
}
const isNeon = dbUrl.includes("neon.tech")

const pool = new pg.Pool({
  connectionString: dbUrl,
  ...(isNeon ? { ssl: { rejectUnauthorized: true } } : {}),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

export const db = drizzle(pool)
export { pool }
