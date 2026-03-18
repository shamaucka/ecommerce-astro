import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as estoqueOps from "@/services/estoque-ops";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "summary": {
        const summary = await estoqueOps.getStockSummary();
        return new Response(
          JSON.stringify({ summary }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "locations": {
        const locations = await estoqueOps.listLocations();
        return new Response(
          JSON.stringify({ locations }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "movements": {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const movements = await estoqueOps.listMovements({ limit });
        return new Response(
          JSON.stringify({ movements }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "summary, locations, movements" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro na operação de estoque" }),
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
      case "entry": {
        const result = await estoqueOps.registerEntry(body);
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "exit": {
        const result = await estoqueOps.registerExit(body);
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "adjust": {
        const result = await estoqueOps.adjustInventory(body);
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "create_location": {
        const location = await estoqueOps.createLocation(body);
        return new Response(
          JSON.stringify({ location }),
          { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ error: "action invalido" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro na operação de estoque" }),
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
