/**
 * One-time bootstrap: creates the admin user if not exists.
 * Protected by SEED_SECRET env var — delete or disable after use.
 */
import type { APIRoute } from "astro"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { db } from "@/db/index.js"
import { astroAdminUser } from "@/db/schema/product.js"

const SEED_SECRET = process.env.SEED_SECRET

export const POST: APIRoute = async ({ request }) => {
  // Must provide SEED_SECRET in header to use this endpoint
  const authHeader = request.headers.get("x-seed-secret")
  if (!SEED_SECRET || authHeader !== SEED_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { email, password } = await request.json()
  if (!email || !password) {
    return new Response(JSON.stringify({ error: "email and password required" }), { status: 400 })
  }

  // Check if user already exists
  const existing = await db.select().from(astroAdminUser).where(eq(astroAdminUser.email, email)).limit(1)
  if (existing.length > 0) {
    return new Response(JSON.stringify({ message: "User already exists", email }), { status: 200 })
  }

  const password_hash = await bcrypt.hash(password, 12)
  const id = "admin_" + Date.now()

  await db.insert(astroAdminUser).values({ id, email, password_hash })

  return new Response(JSON.stringify({ ok: true, created: email }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  })
}
