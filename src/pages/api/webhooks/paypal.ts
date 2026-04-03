import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq } from "drizzle-orm"
import { capiPurchase } from "@/services/tracking-meta"
import { tiktokPurchase } from "@/services/tracking-tiktok"

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || ""

async function verifyPayPalSignature(request: Request, rawBody: string): Promise<boolean> {
  // Rejeita se WEBHOOK_ID não configurado — nunca aceitar sem verificação
  if (!PAYPAL_WEBHOOK_ID) {
    console.error("[SECURITY] PAYPAL_WEBHOOK_ID not set — rejecting webhook")
    return false
  }

  const transmissionId = request.headers.get("paypal-transmission-id")
  const transmissionTime = request.headers.get("paypal-transmission-time")
  const certUrl = request.headers.get("paypal-cert-url")
  const transmissionSig = request.headers.get("paypal-transmission-sig")
  const authAlgo = request.headers.get("paypal-auth-algo")

  if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig || !authAlgo) {
    console.error("[PayPal Webhook] Missing signature headers")
    return false
  }

  // Verify via PayPal API
  try {
    const PAYPAL_BASE = process.env.PAYPAL_ENV === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com"

    const authRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })
    const { access_token } = await authRes.json()

    const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody),
      }),
    })

    const result = await verifyRes.json()
    return result.verification_status === "SUCCESS"
  } catch (e) {
    console.error("[PayPal Webhook] Signature verification failed:", e)
    return false
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text()

    // Verify PayPal signature
    const valid = await verifyPayPalSignature(request, rawBody)
    if (!valid) {
      console.error("[PayPal Webhook] Invalid signature — rejecting")
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 })
    }

    const data = JSON.parse(rawBody)
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
          const meta = (order.metadata || {}) as any

          capiPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
            name: order.customer_name || undefined,
            zip: order.shipping_postal_code || undefined,
            city: order.shipping_city || undefined,
            state: order.shipping_state || undefined,
            ip: meta.client_ip || undefined,
            userAgent: meta.client_ua || undefined,
            fbp: meta.fbp || undefined,
            fbc: meta.fbc || undefined,
            eventId: meta.purchase_event_id || undefined,
            contentIds,
          }).catch(err => console.error("[CAPI PayPal webhook]", err))

          tiktokPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
            ip: meta.client_ip || undefined,
            userAgent: meta.client_ua || undefined,
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
          const meta2 = (order.metadata || {}) as any

          capiPurchase({
            orderId: order.id,
            value: order.total ?? 0,
            email: order.customer_email || undefined,
            phone: order.customer_phone || undefined,
            name: order.customer_name || undefined,
            zip: order.shipping_postal_code || undefined,
            city: order.shipping_city || undefined,
            state: order.shipping_state || undefined,
            ip: meta2.client_ip || undefined,
            userAgent: meta2.client_ua || undefined,
            fbp: meta2.fbp || undefined,
            fbc: meta2.fbc || undefined,
            eventId: meta2.purchase_event_id || undefined,
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
