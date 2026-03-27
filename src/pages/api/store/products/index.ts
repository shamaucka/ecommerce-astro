import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import * as productService from "@/services/product"

export const GET: APIRoute = async ({ url }) => {
  try {
    const action = url.searchParams.get("action")

    if (action === "related") {
      const productId = url.searchParams.get("product_id") || ""
      const limit = parseInt(url.searchParams.get("limit") || "4")
      const products = await productService.getRelatedByHistory(productId, limit)
      return new Response(
        JSON.stringify({ products }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const limit = parseInt(url.searchParams.get("limit") || "100")
    const products = await productService.listPublishedProducts(limit)
    return new Response(
      JSON.stringify({ products, count: products.length }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300", ...corsHeaders } }
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
