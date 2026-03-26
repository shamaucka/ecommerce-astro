import type { APIRoute } from "astro"
import { corsHeaders, getCorsHeaders } from "@/lib/cors"
import { requireAuth } from "@/services/auth"
import * as nfeManager from "@/services/nfe-manager"

export const GET: APIRoute = async ({ request, url }) => {
  const headers = { "Content-Type": "application/json", ...getCorsHeaders(request) }
  try {
    await requireAuth(request)
    const action = url.searchParams.get("action")

    switch (action) {
      case "list": {
        const tipo = url.searchParams.get("tipo") || undefined
        const status = url.searchParams.get("status") || undefined
        const page = parseInt(url.searchParams.get("page") || "1")
        const search = url.searchParams.get("search") || undefined
        const notas = await nfeManager.listNotas({ tipo, status, page, search })
        return new Response(JSON.stringify({ notas }), { status: 200, headers })
      }

      case "stats": {
        const stats = await nfeManager.getStats()
        return new Response(JSON.stringify({ stats }), { status: 200, headers })
      }

      default:
        return new Response(JSON.stringify({ actions: "list, stats" }), { status: 200, headers })
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...getCorsHeaders(request) }
  try {
    await requireAuth(request)
    const body = await request.json()
    const { action } = body

    switch (action) {
      case "emit_saida": {
        if (!body.orderId) throw new Error("orderId obrigatorio")
        const result = await nfeManager.emitirSaida(body.orderId)
        return new Response(JSON.stringify({ result }), { status: 200, headers })
      }

      case "emit_entrada": {
        const result = await nfeManager.emitirEntrada(body)
        return new Response(JSON.stringify({ result }), { status: 200, headers })
      }

      case "cancel": {
        if (!body.id || !body.justificativa) throw new Error("id e justificativa obrigatorios")
        const result = await nfeManager.cancelar(body.id, body.justificativa)
        return new Response(JSON.stringify({ result }), { status: 200, headers })
      }

      case "consult": {
        if (!body.id) throw new Error("id obrigatorio")
        const result = await nfeManager.consultar(body.id)
        return new Response(JSON.stringify({ result }), { status: 200, headers })
      }

      case "danfe": {
        if (!body.id) throw new Error("id obrigatorio")
        const pdf = await nfeManager.gerarDanfe(body.id)
        return new Response(JSON.stringify({ pdf }), { status: 200, headers })
      }

      case "get_imile_label": {
        if (!body.id) throw new Error("id obrigatorio")
        const { db } = await import("@/db/index.js")
        const { nfeRegistro } = await import("@/db/schema/fiscal-br.js")
        const { fulfillmentTask } = await import("@/db/schema/fulfillment.js")
        const { eq } = await import("drizzle-orm")

        // Busca nota fiscal
        const notas = await db.select().from(nfeRegistro).where(eq(nfeRegistro.id, body.id)).limit(1)
        const nota = notas[0]
        if (!nota?.order_id) throw new Error("Nota sem pedido associado")

        // Busca fulfillment task direto no banco pelo order_id
        const tasks = await db.select().from(fulfillmentTask).where(eq(fulfillmentTask.order_id, nota.order_id)).limit(1)
        const task = tasks[0]
        if (!task?.tracking_code) throw new Error("Pedido sem codigo de rastreio iMile")

        // Buscar etiqueta real da iMile via reprintOrder
        try {
          const imile = await import("@/services/imile")
          const label = await imile.getShippingLabel(task.tracking_code)
          // iMile retorna { data: { imileAwb: "base64pdf" } }
          const labelPdf = label?.data?.imileAwb || label?.imileAwb || null
          if (!labelPdf) {
            return new Response(JSON.stringify({ error: "iMile nao retornou PDF da etiqueta", raw: JSON.stringify(label).slice(0, 200) }), { status: 200, headers })
          }
          return new Response(JSON.stringify({ labelBase64: labelPdf, trackingCode: task.tracking_code }), { status: 200, headers })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: "Erro iMile: " + e.message }), { status: 200, headers })
        }
      }

      case "retry": {
        if (!body.id) throw new Error("id obrigatorio")
        const result = await nfeManager.retentar(body.id)
        return new Response(JSON.stringify({ result }), { status: 200, headers })
      }

      default:
        return new Response(JSON.stringify({ error: "action invalido" }), { status: 400, headers })
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) })
}
