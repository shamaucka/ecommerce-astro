import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as shippingService from "@/services/shipping";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "config": {
        const config = await shippingService.getShippingConfig();
        return new Response(
          JSON.stringify({ config }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "zones": {
        const zones = await shippingService.listZones();
        return new Response(
          JSON.stringify({ zones }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "config, zones" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar configuracao de frete" }),
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
      case "save_config": {
        const config = await shippingService.saveShippingConfig(body.data);
        return new Response(
          JSON.stringify({ config }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "create_zone": {
        if (!body.data?.name || !body.data?.states || body.data?.rate === undefined) {
          return new Response(
            JSON.stringify({ error: "name, states e rate sao obrigatorios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const zone = await shippingService.createZone(body.data);
        return new Response(
          JSON.stringify({ zone }),
          { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "update_zone": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatorio" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const zone = await shippingService.updateZone(body.id, body.data);
        return new Response(
          JSON.stringify({ zone }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "delete_zone": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatorio" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await shippingService.deleteZone(body.id);
        return new Response(
          JSON.stringify(result),
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
      JSON.stringify({ error: err.message || "Erro ao processar frete" }),
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
