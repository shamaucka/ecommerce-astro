import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq } from "drizzle-orm"
import * as woovi from "@/services/payment-woovi"

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
        await db.update(astroOrder).set({
          status: "processing",
          payment_status: "paid",
          payment_id: correlationID,
          updated_at: new Date(),
        }).where(eq(astroOrder.id, orderId))

        console.log(`[Woovi Webhook] Order ${orderId} marked as paid (PIX)`)
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
