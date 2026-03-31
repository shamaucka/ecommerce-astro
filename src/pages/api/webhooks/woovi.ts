import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq } from "drizzle-orm"
import * as woovi from "@/services/payment-woovi"
import * as orderService from "@/services/order"
import { capiPurchase } from "@/services/tracking-meta"
import { tiktokPurchase } from "@/services/tracking-tiktok"

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.text()
    const signature = request.headers.get("x-webhook-secret") || ""

    // Validate signature
    if (!woovi.validateWebhook(payload, signature)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 })
    }

    const data = JSON.parse(payload)
    const event = data.event

    // PIX payment confirmed
    if (event === "OPENPIX:CHARGE_COMPLETED" || event === "OPENPIX:TRANSACTION_RECEIVED") {
      const charge = data.charge || data.pix
      const correlationID = charge?.correlationID
      const orderId = charge?.additionalInfo?.find((i: any) => i.key === "orderId")?.value

      if (orderId) {
        // Marca como pago + cria fulfillment task
        const order = await orderService.markAsPaid(orderId, correlationID)
        console.log(`[Woovi Webhook] Order ${orderId} marked as paid (PIX)`)
        if (order) {
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
          }).catch(err => console.error("[CAPI Woovi webhook]", err))

          tiktokPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
          }).catch(err => console.error("[TikTok Woovi webhook]", err))
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err: any) {
    console.error("[Woovi Webhook Error]", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
}

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ status: "ok", service: "woovi-webhook" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
