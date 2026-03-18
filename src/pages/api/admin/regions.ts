import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as productService from "@/services/product";

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);

    const regions = await productService.listRegions();

    return new Response(
      JSON.stringify({ regions }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao listar regiões" }),
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
