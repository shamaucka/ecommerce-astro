import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as productService from "@/services/product";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    await requireAuth(request);

    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ error: "ID do produto é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await request.json();
    const product = await productService.updateProduct(id, body);

    return new Response(
      JSON.stringify({ product }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao atualizar produto" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    await requireAuth(request);

    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ error: "ID do produto é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await productService.deleteProduct(id);

    return new Response(
      JSON.stringify({ id, deleted: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao deletar produto" }),
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
