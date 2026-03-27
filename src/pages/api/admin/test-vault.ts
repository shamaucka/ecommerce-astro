import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { requireAuth } from "@/services/auth"
import * as vault from "@/services/test-vault"

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request)
    const cards = await vault.listCards()
    return new Response(
      JSON.stringify({ cards }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request)
    const body = await request.json()
    const { action } = body

    if (action === "save") {
      const result = await vault.saveCard(body)
      return new Response(
        JSON.stringify({ result }),
        { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    if (action === "delete") {
      const result = await vault.deleteCard(body.id)
      return new Response(
        JSON.stringify({ result }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    return new Response(
      JSON.stringify({ error: "action invalido" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
