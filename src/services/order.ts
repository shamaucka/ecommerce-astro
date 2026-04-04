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
      const { astroProduct } = await import("../db/schema/product.js")
      const { astroProductVariant } = await import("../db/schema/product.js")

      const orderItems = (order.items as any[]) || []
      const items = []
      for (const item of orderItems) {
        let realSku = item.sku || item.product_id || ""
        if (realSku.includes("-")) {
          try {
            const [prod] = await db.select({ id: astroProduct.id })
              .from(astroProduct)
              .where(eq(astroProduct.handle, realSku))
              .limit(1)
            if (prod) {
              const [variant] = await db.select({ sku: astroProductVariant.sku })
                .from(astroProductVariant)
                .where(eq(astroProductVariant.product_id, prod.id))
                .limit(1)
              if (variant?.sku) realSku = variant.sku
            }
          } catch {}
        }
        items.push({
          product_id: item.product_id || item.sku || "",
          variant_id: item.variant_id || undefined,
          sku: realSku,
          product_title: item.title || item.name || "Quadro",
          variant_title: item.variant_title || undefined,
          quantity: item.quantity || 1,
        })
      }
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

  // Email de despacho quando status muda para shipped
  if (status === "shipped") {
    try {
      const order = result[0]
      if (order.customer_email && order.tracking_number) {
        const { sendShippingNotification } = await import("./email.js")
        await sendShippingNotification({
          display_id: order.display_id || id.slice(0, 8),
          customer_name: order.customer_name || "Cliente",
          customer_email: order.customer_email,
          tracking_number: order.tracking_number,
          carrier: "iMile",
        })
      }
    } catch (e: any) {
      console.warn("[updateOrderStatus] Shipping email skipped:", e.message)
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

    // Busca SKU real das variantes pelo handle/slug do produto
    const { astroProduct } = await import("../db/schema/product.js")
    const { astroProductVariant } = await import("../db/schema/product.js")

    const orderItems = (order.items as any[]) || []
    const items = []
    for (const item of orderItems) {
      let realSku = item.sku || item.product_id || ""
      // Se o SKU parece slug (tem hifens), busca o SKU real da variante
      if (realSku.includes("-")) {
        try {
          const [prod] = await db.select({ id: astroProduct.id })
            .from(astroProduct)
            .where(eq(astroProduct.handle, realSku))
            .limit(1)
          if (prod) {
            const [variant] = await db.select({ sku: astroProductVariant.sku })
              .from(astroProductVariant)
              .where(eq(astroProductVariant.product_id, prod.id))
              .limit(1)
            if (variant?.sku) realSku = variant.sku
          }
        } catch {}
      }
      items.push({
        product_id: item.product_id || item.sku || "",
        variant_id: item.variant_id || undefined,
        sku: realSku,
        product_title: item.title || item.name || "Quadro",
        variant_title: item.variant_title || undefined,
        quantity: item.quantity || 1,
      })
    }

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

  // Envia CAPI Purchase ao Meta (server-side tracking)
  try {
    const [orderForCapi] = await db.select().from(astroOrder).where(eq(astroOrder.id, id)).limit(1)
    if (orderForCapi) {
      const { capiPurchase } = await import("./tracking-meta.js")
      const meta = (orderForCapi.metadata || {}) as any
      const contentIds = ((orderForCapi.items as any[]) || []).map((i: any) => i.product_id || i.sku || "")

      await capiPurchase({
        orderId: orderForCapi.id,
        value: orderForCapi.total ?? 0,
        email: orderForCapi.customer_email || undefined,
        phone: orderForCapi.customer_phone || undefined,
        name: orderForCapi.customer_name || undefined,
        zip: orderForCapi.shipping_postal_code || undefined,
        city: orderForCapi.shipping_city || undefined,
        state: orderForCapi.shipping_state || undefined,
        ip: meta.client_ip || undefined,
        userAgent: meta.client_ua || undefined,
        fbp: meta.fbp || undefined,
        fbc: meta.fbc || undefined,
        eventId: meta.purchase_event_id || undefined,
        contentIds,
      })
      console.log(`[markAsPaid] CAPI Purchase sent for order ${id}`)
    }
  } catch (e: any) {
    console.warn("[markAsPaid] CAPI skipped:", e.message)
  }

  // Envia email de confirmação
  const [updatedOrder] = await db.select().from(astroOrder).where(eq(astroOrder.id, id)).limit(1)
  if (updatedOrder?.customer_email) {
    try {
      const { sendOrderConfirmation } = await import("./email.js")
      await sendOrderConfirmation({
        display_id: updatedOrder.display_id || id.slice(0, 8),
        customer_name: updatedOrder.customer_name || "Cliente",
        customer_email: updatedOrder.customer_email,
        items: (updatedOrder.items as any[]) || [],
        total: updatedOrder.total || 0,
        subtotal: updatedOrder.subtotal || 0,
        shipping_cost: updatedOrder.shipping_cost || 0,
        discount_amount: updatedOrder.discount_amount || 0,
        payment_method: updatedOrder.payment_method || undefined,
        shipping_city: updatedOrder.shipping_city || undefined,
        shipping_state: updatedOrder.shipping_state || undefined,
      })
    } catch (e: any) {
      console.warn("[markAsPaid] Email skipped:", e.message)
    }
  }

  return updatedOrder
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
