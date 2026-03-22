import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import * as productService from "@/services/product"

export const GET: APIRoute = async ({ params }) => {
  try {
    const handle = params.handle!
    const product = await productService.getProductByHandle(handle)
    return new Response(
      JSON.stringify({ product }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300", ...corsHeaders } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
