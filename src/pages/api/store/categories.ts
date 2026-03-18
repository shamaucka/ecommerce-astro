import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import * as categoryService from "@/services/category";

export const GET: APIRoute = async () => {
  try {
    const categories = await categoryService.listCategories();
    return new Response(
      JSON.stringify({ categories }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar categorias" }),
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
