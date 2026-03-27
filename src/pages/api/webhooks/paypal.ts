import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq } from "drizzle-orm"
import { capiPurchase } from "@/services/tracking-meta"
import { tiktokPurchase } from "@/services/tracking-tiktok"

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json()
    const eventType = data.event_type

    // Payment captured
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const capture = data.resource
      const orderId = capture?.supplementary_data?.related_ids?.order_id

      // Find our order by payment_id (PayPal order ID)
      if (orderId) {
        const orders = await db.select().from(astroOrder).where(eq(astroOrder.payment_id, orderId)).limit(1)
        if (orders[0]) {
          await db.update(astroOrder).set({
            status: "processing",
            payment_status: "paid",
            updated_at: new Date(),
          }).where(eq(astroOrder.id, orders[0].id))

          console.log(`[PayPal Webhook] Order ${orders[0].id} marked as paid`)

          // Server-side conversion tracking
          const order = orders[0]
          const contentIds = (Array.isArray(order.items) ? order.items : []).map((i: any) => i.product_id || i.sku || "")

          capiPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
            name: order.customer_name || undefined,
            zip: order.shipping_postal_code || undefined,
            city: order.shipping_city || undefined,
            state: order.shipping_state || undefined,
            contentIds,
          }).catch(err => console.error("[CAPI PayPal webhook]", err))

          tiktokPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
          }).catch(err => console.error("[TikTok PayPal webhook]", err))
        }
      }
    }

    // PayPal Plus (v1 API) - sale completed
    if (eventType === "PAYMENT.SALE.COMPLETED") {
      const sale = data.resource
      const saleId = sale?.id
      const customField = sale?.soft_descriptor || ""

      // Try to find order by ppplus_payment_id stored in payment_id
      // PayPal Plus stores payment ID as PAY-xxx
      const parentPayment = sale?.parent_payment
      if (parentPayment) {
        const orders = await db.select().from(astroOrder).where(eq(astroOrder.payment_id, parentPayment)).limit(1)
        if (orders[0]) {
          await db.update(astroOrder).set({
            status: "processing",
            payment_status: "paid",
            updated_at: new Date(),
          }).where(eq(astroOrder.id, orders[0].id))

          console.log(`[PayPal Webhook] PPPlus Order ${orders[0].id} marked as paid via sale ${saleId}`)

          // Server-side conversion tracking
          const order = orders[0]
          const contentIds = (Array.isArray(order.items) ? order.items : []).map((i: any) => i.product_id || i.sku || "")

          capiPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
            name: order.customer_name || undefined,
            zip: order.shipping_postal_code || undefined,
            city: order.shipping_city || undefined,
            state: order.shipping_state || undefined,
            contentIds,
          }).catch(err => console.error("[CAPI PayPal Plus webhook]", err))

          tiktokPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
          }).catch(err => console.error("[TikTok PayPal Plus webhook]", err))
        }
      }
    }

    // Payment refunded
    if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
      const refund = data.resource
      console.log("[PayPal Webhook] Refund:", refund?.id)
    }

    // PayPal Plus refund
    if (eventType === "PAYMENT.SALE.REFUNDED" || eventType === "PAYMENT.SALE.REVERSED") {
      const sale = data.resource
      console.log(`[PayPal Webhook] PPPlus ${eventType}:`, sale?.id)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err: any) {
    console.error("[PayPal Webhook Error]", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
}

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ status: "ok", service: "paypal-webhook" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
