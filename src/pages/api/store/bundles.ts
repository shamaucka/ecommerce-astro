import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import * as bundleService from "@/services/bundle";

export const GET: APIRoute = async ({ url }) => {
  try {
    const product_id = url.searchParams.get("product_id");
    if (!product_id) {
      return new Response(
        JSON.stringify({ error: "product_id é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const bundles = await bundleService.getBundlesForProduct(product_id);
    return new Response(
      JSON.stringify({ bundles }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar kits" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};
