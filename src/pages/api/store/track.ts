import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { capiEvent } from "@/services/tracking-meta"

/**
 * POST /api/store/track
 * Recebe eventos do frontend e envia via CAPI (server-side)
 * para deduplicação com o Pixel (browser-side).
 *
 * Body: { event, eventId, value, currency, contentIds, contentName,
 *         numItems, sourceUrl, fbp, fbc, email, phone, externalId }
 */
export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    const body = await request.json()
    const { event, eventId, value, currency, contentIds, contentName, numItems, sourceUrl, fbp, fbc, email, phone, externalId } = body

    if (!event) {
      return new Response(JSON.stringify({ error: "event required" }), { status: 400, headers })
    }

    // Permitir apenas eventos conhecidos
    const allowed = ["AddToCart", "ViewContent", "InitiateCheckout", "AddPaymentInfo"]
    if (!allowed.includes(event)) {
      return new Response(JSON.stringify({ error: "event not allowed" }), { status: 400, headers })
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("cf-connecting-ip")
      || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    capiEvent({
      event_name: event,
      eventId,
      value,
      currency,
      contentIds,
      contentName,
      numItems,
      sourceUrl,
      ip,
      userAgent,
      fbp,
      fbc,
      email,
      phone,
      externalId,
    }).catch(err => console.error(`[CAPI ${event}]`, err.message))

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
