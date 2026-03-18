import { eq, desc, sql, count } from "drizzle-orm"
import { db } from "../db/index.js"
import { astroOrder } from "../db/schema/order.js"

// ========== ORDERS ==========

export async function listOrders(status?: string, limit = 100) {
  let query = db
    .select()
    .from(astroOrder)

  if (status) {
    query = query.where(eq(astroOrder.status, status)) as any
  }

  return query
    .orderBy(desc(astroOrder.created_at))
    .limit(limit)
}

export async function getOrder(id: string) {
  const results = await db
    .select()
    .from(astroOrder)
    .where(eq(astroOrder.id, id))
    .limit(1)

  if (!results[0]) throw new Error(`Pedido ${id} nao encontrado`)
  return results[0]
}

export async function createOrder(data: {
  customer_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  customer_cpf?: string
  items: any[]
  subtotal: number
  shipping_cost?: number
  discount_amount?: number
  payment_method?: string
  shipping_cep?: string
  shipping_street?: string
  shipping_number?: string
  shipping_complement?: string
  shipping_neighborhood?: string
  shipping_city?: string
  shipping_state?: string
  coupon_code?: string
  notes?: string
  metadata?: any
}) {
  const displayId = "PED-" + String(Math.floor(100000 + Math.random() * 900000))
  const subtotal = data.subtotal
  const shippingCost = data.shipping_cost || 0
  const discountAmount = data.discount_amount || 0
  const total = subtotal + shippingCost - discountAmount

  const result = await db
    .insert(astroOrder)
    .values({
      id: crypto.randomUUID(),
      display_id: displayId,
      status: "pending",
      ...data,
      subtotal,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      total,
      payment_status: "pending",
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

export async function updateOrderStatus(id: string, status: string) {
  const timestamps: Record<string, any> = { updated_at: new Date() }

  if (status === "shipped") timestamps.shipped_at = new Date()
  if (status === "delivered") timestamps.delivered_at = new Date()
  if (status === "cancelled") timestamps.cancelled_at = new Date()

  const result = await db
    .update(astroOrder)
    .set({ status, ...timestamps })
    .where(eq(astroOrder.id, id))
    .returning()

  if (!result[0]) throw new Error(`Pedido ${id} nao encontrado`)
  return result[0]
}

export async function getOrderStats() {
  const rows = await db
    .select({
      status: astroOrder.status,
      total: count(),
    })
    .from(astroOrder)
    .groupBy(astroOrder.status)

  const stats: Record<string, number> = {}
  for (const row of rows) {
    stats[row.status || "unknown"] = row.total
  }
  return stats
}
