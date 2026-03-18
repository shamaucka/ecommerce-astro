import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as fiscalBr from "@/services/fiscal-br";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "store_config": {
        const config = await fiscalBr.getStoreConfig();
        return new Response(
          JSON.stringify({ config }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "batch": {
        const productIds = url.searchParams.get("product_ids");
        if (!productIds) {
          return new Response(
            JSON.stringify({ error: "product_ids é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const fiscals = await fiscalBr.getByProductIds(productIds.split(","));
        return new Response(
          JSON.stringify({ fiscals }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "store_config, batch" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro na operação fiscal" }),
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
      case "save_store_config": {
        const config = await fiscalBr.upsertStoreConfig(body);
        return new Response(
          JSON.stringify({ config }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "upsert": {
        const fiscal = await fiscalBr.upsertFiscal(body.product_id, body);
        return new Response(
          JSON.stringify({ fiscal }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
      JSON.stringify({ error: err.message || "Erro na operação fiscal" }),
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
