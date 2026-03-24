import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { config } from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

// Ensure .env is loaded
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../../.env") })

const dbUrl = process.env.DATABASE_URL || "postgres://thaiszimmermann@localhost/ecommerce-astro"
const isNeon = dbUrl.includes("neon.tech")

const pool = new pg.Pool({
  connectionString: dbUrl,
  ...(isNeon ? { ssl: { rejectUnauthorized: false } } : {}),
})

export const db = drizzle(pool)
export { pool }
