import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq } from "drizzle-orm"

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
        }
      }
    }

    // Payment refunded
    if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
      const refund = data.resource
      console.log("[PayPal Webhook] Refund:", refund?.id)
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
