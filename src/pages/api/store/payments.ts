import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import * as woovi from "@/services/payment-woovi"
import * as paypal from "@/services/payment-paypal"
import * as orderService from "@/services/order"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq } from "drizzle-orm"
import { capiPurchase } from "@/services/tracking-meta"
import { tiktokPurchase } from "@/services/tracking-tiktok"

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      // ═══ PIX via Woovi ═══
      case "pix_create": {
        const { orderId, displayId, amount, customerName, customerEmail, customerCpf } = body
        if (!orderId || !amount) throw new Error("orderId e amount obrigatorios")

        const charge = await woovi.createPixCharge({
          orderId, displayId: displayId || orderId,
          amount, customerName, customerEmail, customerCpf,
        })

        // Update order with payment info
        await db.update(astroOrder).set({
          payment_method: "pix",
          payment_id: charge.chargeId,
          payment_status: "pending",
          updated_at: new Date(),
        }).where(eq(astroOrder.id, orderId))

        return new Response(JSON.stringify(charge), { status: 200, headers })
      }

      case "pix_status": {
        const { chargeId } = body
        if (!chargeId) throw new Error("chargeId obrigatorio")
        const status = await woovi.getChargeStatus(chargeId)
        return new Response(JSON.stringify(status), { status: 200, headers })
      }

      // ═══ Cartão via PayPal ═══
      case "paypal_create": {
        const { orderId, displayId, amount, customerEmail, items, shippingCost } = body
        if (!orderId || !amount) throw new Error("orderId e amount obrigatorios")

        const order = await paypal.createOrder({
          orderId, displayId: displayId || orderId,
          amount, customerEmail,
          items: items || [{ name: "Quadro Decorativo", quantity: 1, unitPrice: amount }],
          shippingCost,
        })

        // Update order with payment info
        await db.update(astroOrder).set({
          payment_method: "credit_card",
          payment_id: order.paypalOrderId,
          payment_status: "pending",
          updated_at: new Date(),
        }).where(eq(astroOrder.id, orderId))

        return new Response(JSON.stringify(order), { status: 200, headers })
      }

      // ═══ Cartão direto (PayPal card processing) ═══
      case "card_pay": {
        const { orderId, displayId, amount, customerEmail, card, items, shippingCost } = body
        if (!orderId || !amount || !card) throw new Error("orderId, amount e card obrigatorios")

        const result = await paypal.processCard({
          orderId, displayId: displayId || orderId,
          amount, customerEmail,
          card,
          items: items || [{ name: "Quadro Decorativo", quantity: 1, unitPrice: amount }],
          shippingCost,
        })

        // Update order
        if (result.paid && orderId) {
          await db.update(astroOrder).set({ payment_method: "credit_card", payment_id: result.paypalOrderId, updated_at: new Date() }).where(eq(astroOrder.id, orderId))
          await orderService.markAsPaid(orderId, result.paypalOrderId)
        } else if (orderId) {
          await db.update(astroOrder).set({ payment_method: "credit_card", payment_id: result.paypalOrderId, payment_status: "failed", updated_at: new Date() }).where(eq(astroOrder.id, orderId))
        }

        return new Response(JSON.stringify(result), { status: 200, headers })
      }

      case "paypal_capture": {
        const { paypalOrderId, orderId } = body
        if (!paypalOrderId) throw new Error("paypalOrderId obrigatorio")

        const capture = await paypal.captureOrder(paypalOrderId)

        if (capture.paid && orderId) {
          await orderService.markAsPaid(orderId, paypalOrderId)
        }

        return new Response(JSON.stringify(capture), { status: 200, headers })
      }

      // ═══ PayPal Plus (Brazil iframe) - create ═══
      case "ppplus_create": {
        const { orderId, displayId, amount, customerName, customerEmail, customerCpf } = body
        if (!orderId || !amount || !customerCpf) throw new Error("orderId, amount e customerCpf obrigatorios")

        const result = await paypal.createPlusPayment({
          orderId,
          displayId: displayId || orderId,
          amount,
          customerName: customerName || "",
          customerEmail: customerEmail || "",
          customerCpf,
        })

        await db.update(astroOrder).set({
          payment_method: "credit_card",
          payment_id: result.paymentId,
          payment_status: "pending",
          updated_at: new Date(),
        }).where(eq(astroOrder.id, orderId))

        return new Response(JSON.stringify(result), { status: 200, headers })
      }

      // ═══ PayPal Plus (Brazil iframe) - execute after payer approval ═══
      case "ppplus_execute": {
        const { orderId, paymentId, payerId, eventId } = body
        if (!paymentId || !payerId) throw new Error("paymentId e payerId obrigatorios")

        const result = await paypal.executePlusPayment(paymentId, payerId)

        if (orderId && result.paid) {
          // Marca como pago + cria fulfillment task
          const order = await orderService.markAsPaid(orderId, paymentId)

          if (order) {
            const meta = (order.metadata || {}) as any
            const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || meta.client_ip || undefined
            const userAgent = request.headers.get("user-agent") || meta.client_ua || undefined
            const fbp = body.fbp || meta.fbp || undefined
            const fbc = body.fbc || meta.fbc || undefined
            const ttclid = body.ttclid || undefined
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
              ip, userAgent, fbp, fbc,
              eventId: eventId || undefined, // same ID the pixel used → proper dedup
              contentIds,
            }).catch(err => console.error("[CAPI ppplus_execute]", err))

            tiktokPurchase({
              orderId: order.id,
              value: order.total ?? 0,
              email: order.customer_email || undefined,
              phone: order.customer_phone || undefined,
              ip, userAgent, ttclid,
            }).catch(err => console.error("[TikTok ppplus_execute]", err))
          }
        }

        return new Response(JSON.stringify(result), { status: 200, headers })
      }

      default:
        return new Response(JSON.stringify({ error: "action invalido" }), { status: 400, headers })
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
