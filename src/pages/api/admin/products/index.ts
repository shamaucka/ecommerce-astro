import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as productService from "@/services/product";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const limit = parseInt(url.searchParams.get("limit") || "50");
    const products = await productService.listProducts(limit);

    return new Response(
      JSON.stringify({ products }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao listar produtos" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);

    const body = await request.json();
    const product = await productService.createProduct(body);

    return new Response(
      JSON.stringify({ product }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao criar produto" }),
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
