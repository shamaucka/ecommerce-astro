import { eq, desc, ilike, and, or, sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { astroCustomer } from "../db/schema/customer.js"

// ========== CUSTOMERS ==========

export async function listCustomers(search?: string, limit = 100) {
  let query = db
    .select()
    .from(astroCustomer)

  if (search) {
    query = query.where(
      or(
        ilike(astroCustomer.name, `%${search}%`),
        ilike(astroCustomer.email, `%${search}%`)
      )
    ) as any
  }

  return query
    .orderBy(desc(astroCustomer.created_at))
    .limit(limit)
}

export async function getCustomer(id: string) {
  const results = await db
    .select()
    .from(astroCustomer)
    .where(eq(astroCustomer.id, id))
    .limit(1)

  if (!results[0]) throw new Error(`Cliente ${id} nao encontrado`)
  return results[0]
}

export async function getOrCreateByEmail(email: string, data: {
  name: string
  phone?: string
  cpf?: string
  address_cep?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
}) {
  const existing = await db
    .select()
    .from(astroCustomer)
    .where(eq(astroCustomer.email, email))
    .limit(1)

  if (existing[0]) return existing[0]

  const result = await db
    .insert(astroCustomer)
    .values({
      id: crypto.randomUUID(),
      email,
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

export async function updateCustomer(id: string, data: Record<string, any>) {
  const result = await db
    .update(astroCustomer)
    .set({ ...data, updated_at: new Date() })
    .where(eq(astroCustomer.id, id))
    .returning()

  if (!result[0]) throw new Error(`Cliente ${id} nao encontrado`)
  return result[0]
}

export async function incrementOrderCount(id: string, orderTotal: number) {
  const result = await db
    .update(astroCustomer)
    .set({
      order_count: sql`${astroCustomer.order_count} + 1`,
      total_spent: sql`${astroCustomer.total_spent} + ${orderTotal}`,
      updated_at: new Date(),
    })
    .where(eq(astroCustomer.id, id))
    .returning()

  if (!result[0]) throw new Error(`Cliente ${id} nao encontrado`)
  return result[0]
}
