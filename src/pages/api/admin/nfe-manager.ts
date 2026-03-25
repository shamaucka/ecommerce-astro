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
