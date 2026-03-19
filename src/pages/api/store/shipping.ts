import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import * as shippingService from "@/services/shipping";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "calculate": {
        if (!body.cep || body.cartTotal === undefined) {
          return new Response(
            JSON.stringify({ error: "cep e cartTotal sao obrigatorios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await shippingService.calculateShipping(
          body.cep,
          body.cartTotal,
          body.cartItems
        );
        return new Response(
          JSON.stringify({ shipping: result }),
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
      JSON.stringify({ error: err.message || "Erro ao calcular frete" }),
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
