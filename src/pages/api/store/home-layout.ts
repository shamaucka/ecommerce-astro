import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import * as homeLayoutService from "@/services/home-layout";

export const GET: APIRoute = async () => {
  try {
    const layout = await homeLayoutService.getLayout();
    return new Response(
      JSON.stringify({ layout }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar layout" }),
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
