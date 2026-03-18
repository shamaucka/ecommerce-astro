import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as homeLayoutService from "@/services/home-layout";

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);

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

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "save": {
        if (!body.sections) {
          return new Response(
            JSON.stringify({ error: "sections é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const layout = await homeLayoutService.saveLayout(body.sections);
        return new Response(
          JSON.stringify({ layout }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ error: "action inválido" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao processar layout" }),
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
