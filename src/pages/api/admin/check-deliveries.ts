import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { astroOrder } from "@/db/schema/order.js"
import { eq } from "drizzle-orm"
import * as imile from "@/services/imile"
import * as orderService from "@/services/order"
import { requireAuth } from "@/services/auth"

/**
 * Verifica pedidos "shipped" na iMile e marca como "delivered" automaticamente.
 *
 * GET /api/admin/check-deliveries (autenticado)
 * POST /api/admin/check-deliveries (com cron secret)
 */

async function checkDeliveries() {
  // Busca pedidos com status shipped que têm tracking_number
  const shippedOrders = await db.select()
    .from(astroOrder)
    .where(eq(astroOrder.status, "shipped"))
    .limit(100)

  const withTracking = shippedOrders.filter(o => o.tracking_number)
  if (withTracking.length === 0) return { checked: 0, delivered: 0, orders: [] }

  const results = { checked: withTracking.length, delivered: 0, orders: [] as string[] }

  // Consulta em batch (max 100) se tiver muitos, senão individual
  for (const order of withTracking) {
    try {
      const trackData = await imile.trackOrder(order.tracking_number!)
      const tracks = trackData?.data?.trackInfoList || trackData?.data?.trackDetailList || []

      // iMile status codes de entrega: "Delivered", "Signed", "POD"
      const isDelivered = tracks.some((t: any) => {
        const desc = (t.trackDescription || t.trackInfo || t.statusDescription || "").toLowerCase()
        const status = (t.status || t.trackStatus || "").toLowerCase()
        return desc.includes("deliver") || desc.includes("entreg") || desc.includes("signed")
          || status.includes("deliver") || status === "pod" || status === "signed"
      })

      if (isDelivered) {
        await orderService.updateOrderStatus(order.id, "delivered")
        results.delivered++
        results.orders.push(`${order.display_id} (${order.customer_name})`)
        console.log(`[check-deliveries] Order ${order.display_id} marked as delivered`)
      }
    } catch (e: any) {
      console.warn(`[check-deliveries] Error checking ${order.display_id}:`, e.message)
    }
  }

  console.log(`[check-deliveries] Checked ${results.checked}, delivered ${results.delivered}`)
  return results
}

export const GET: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    await requireAuth(request)
    const result = await checkDeliveries()
    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    const body = await request.json()
    const cronSecret = process.env.CRON_SECRET || "tess-cron-2026"
    if (body.secret !== cronSecret) {
      return new Response(JSON.stringify({ error: "invalid secret" }), { status: 401, headers })
    }
    const result = await checkDeliveries()
    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
