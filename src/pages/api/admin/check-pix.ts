import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq, and } from "drizzle-orm"
import * as woovi from "@/services/payment-woovi"
import * as orderService from "@/services/order"
import { requireAuth } from "@/services/auth"

/**
 * Verifica pedidos PIX pendentes e atualiza os que já foram pagos na Woovi.
 * Resolve o problema de webhooks que não chegam.
 *
 * GET /api/admin/check-pix — verifica todos os PIX pendentes
 * POST /api/admin/check-pix — com body { secret: "cron-secret" } para chamadas automaticas
 */
export const GET: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    await requireAuth(request)
    const result = await checkPendingPix()
    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

// POST para chamadas via cron (sem auth, usa secret)
export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    const body = await request.json()
    const cronSecret = process.env.CRON_SECRET || "tess-cron-2026"
    if (body.secret !== cronSecret) {
      return new Response(JSON.stringify({ error: "invalid secret" }), { status: 401, headers })
    }
    const result = await checkPendingPix()
    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

async function checkPendingPix() {
  // Busca pedidos PIX com payment_status pendente (últimas 24h)
  const pendingOrders = await db.select()
    .from(astroOrder)
    .where(and(
      eq(astroOrder.payment_method, "pix"),
      eq(astroOrder.payment_status, "pending"),
    ))
    .limit(50)

  const results = { checked: 0, updated: 0, orders: [] as string[] }

  for (const order of pendingOrders) {
    if (!order.payment_id) continue
    results.checked++

    try {
      const status = await woovi.getChargeStatus(order.payment_id)
      if (status.paid) {
        // Marca como pago + cria fulfillment + envia email
        await orderService.markAsPaid(order.id, order.payment_id)
        results.updated++
        results.orders.push(`${order.display_id} (${order.customer_name})`)
        console.log(`[check-pix] Order ${order.display_id} marked as paid (was pending)`)
      }
    } catch (e: any) {
      console.warn(`[check-pix] Error checking ${order.display_id}:`, e.message)
    }
  }

  console.log(`[check-pix] Checked ${results.checked}, updated ${results.updated}`)
  return results
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
