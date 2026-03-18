import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://thaiszimmermann@localhost/ecommerce-astro",
})

export const db = drizzle(pool)
export { pool }
