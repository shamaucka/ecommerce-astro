import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { requireAuth } from "@/services/auth"
import * as nfeEmitter from "@/services/nfe-emitter"

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders(request) }

  try {
    await requireAuth(request)
    const body = await request.json()
    const { action } = body

    switch (action) {
      case "emitir": {
        const resultado = await nfeEmitter.emitirNFe(body.data)
        return new Response(JSON.stringify({ resultado }), { status: 200, headers })
      }

      case "consultar": {
        if (!body.chave) return new Response(JSON.stringify({ error: "chave obrigatoria" }), { status: 400, headers })
        const resultado = await nfeEmitter.consultarNFe(body.chave)
        return new Response(JSON.stringify({ resultado }), { status: 200, headers })
      }

      case "cancelar": {
        if (!body.chave || !body.protocolo || !body.justificativa) {
          return new Response(JSON.stringify({ error: "chave, protocolo e justificativa obrigatorios" }), { status: 400, headers })
        }
        const resultado = await nfeEmitter.cancelarNFe(body.chave, body.protocolo, body.justificativa)
        return new Response(JSON.stringify({ resultado }), { status: 200, headers })
      }

      case "status_sefaz": {
        const resultado = await nfeEmitter.statusSefaz()
        return new Response(JSON.stringify({ resultado }), { status: 200, headers })
      }

      case "danfe": {
        if (!body.xml) return new Response(JSON.stringify({ error: "xml obrigatorio" }), { status: 400, headers })
        const pdf = await nfeEmitter.gerarDanfe(body.xml)
        return new Response(JSON.stringify({ pdf }), { status: 200, headers })
      }

      default:
        return new Response(JSON.stringify({ error: "action invalido. Use: emitir, consultar, cancelar, status_sefaz, danfe" }), { status: 400, headers })
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro no emissor NFe" }), { status: 400, headers })
  }
}

export const GET: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders(request) }
  try {
    await requireAuth(request)
    const resultado = await nfeEmitter.statusSefaz()
    return new Response(JSON.stringify({ sefaz: resultado }), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}
