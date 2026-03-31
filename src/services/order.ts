import { eq, desc, sql, count } from "drizzle-orm"
import { db } from "../db/index.js"
import { astroOrder } from "../db/schema/order.js"
import * as fulfillmentOps from "./fulfillment-ops.js"

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
  shipping_address_line1?: string
  shipping_address_line2?: string
  shipping_neighborhood?: string
  shipping_city?: string
  shipping_state?: string
  shipping_postal_code?: string
  coupon_code?: string
  metadata?: any
}) {
  // Display ID sequencial: 9000001, 9000002, ...
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(astroOrder)
  const orderCount = Number(countResult[0]?.count || 0)
  const displayId = String(9000001 + orderCount)

  const subtotal = data.subtotal
  const shippingCost = data.shipping_cost || 0
  const discountAmount = data.discount_amount || 0
  // discount_amount é informativo — subtotal já vem com promo aplicada
  // total = subtotal + frete (desconto já está no subtotal)
  const total = subtotal + shippingCost

  const result = await db
    .insert(astroOrder)
    .values({
      id: crypto.randomUUID(),
      display_id: displayId,
      status: "pending",
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      customer_cpf: data.customer_cpf,
      items: data.items,
      subtotal,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      total,
      payment_method: data.payment_method,
      payment_status: "pending",
      shipping_address_line1: data.shipping_address_line1,
      shipping_address_line2: data.shipping_address_line2,
      shipping_neighborhood: data.shipping_neighborhood,
      shipping_city: data.shipping_city,
      shipping_state: data.shipping_state,
      shipping_postal_code: data.shipping_postal_code,
      coupon_code: data.coupon_code,
      metadata: data.metadata,
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

  // Criar fulfillment task quando pedido muda para processing (pago)
  if (status === "processing") {
    try {
      const order = result[0]
      const orderItems = (order.items as any[]) || []
      const items = orderItems.map((item: any) => ({
        product_id: item.product_id || item.sku || "",
        variant_id: item.variant_id || undefined,
        sku: item.sku || item.product_id || "",
        product_title: item.title || item.name || "Quadro",
        variant_title: item.variant_title || undefined,
        quantity: item.quantity || 1,
      }))
      await fulfillmentOps.createFromOrder({
        order_id: order.id,
        display_id: order.display_id || undefined,
        customer_name: order.customer_name || order.customer_email || undefined,
        customer_email: order.customer_email || undefined,
        order_total: order.total || 0,
        items,
      })
    } catch (e: any) {
      console.warn("Fulfillment task creation skipped:", e.message)
    }
  }

  return result[0]
}

/**
 * Marca pedido como pago e cria fulfillment task.
 * Usar em vez de db.update direto nos webhooks/payments.
 */
export async function markAsPaid(id: string, paymentId?: string) {
  // Atualiza status
  await db.update(astroOrder).set({
    status: "processing",
    payment_status: "paid",
    ...(paymentId ? { payment_id: paymentId } : {}),
    updated_at: new Date(),
  }).where(eq(astroOrder.id, id))

  // Cria fulfillment task
  try {
    const [order] = await db.select().from(astroOrder).where(eq(astroOrder.id, id)).limit(1)
    if (!order) return null

    const orderItems = (order.items as any[]) || []
    const items = orderItems.map((item: any) => ({
      product_id: item.product_id || item.sku || "",
      variant_id: item.variant_id || undefined,
      sku: item.sku || item.product_id || "",
      product_title: item.title || item.name || "Quadro",
      variant_title: item.variant_title || undefined,
      quantity: item.quantity || 1,
    }))

    await fulfillmentOps.createFromOrder({
      order_id: order.id,
      display_id: order.display_id || undefined,
      customer_name: order.customer_name || order.customer_email || undefined,
      customer_email: order.customer_email || undefined,
      order_total: order.total || 0,
      items,
    })
    console.log(`[markAsPaid] Fulfillment task created for order ${id}`)
  } catch (e: any) {
    console.warn("[markAsPaid] Fulfillment task skipped:", e.message)
  }

  const [order] = await db.select().from(astroOrder).where(eq(astroOrder.id, id)).limit(1)
  return order
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
