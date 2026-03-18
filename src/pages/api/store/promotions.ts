import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import * as promotionService from "@/services/promotion";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "validate": {
        const { code, cart } = body;
        if (!code || !cart) {
          return new Response(
            JSON.stringify({ error: "code e cart são obrigatórios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await promotionService.validateCoupon(code, cart);
        return new Response(
          JSON.stringify({ result }),
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
      JSON.stringify({ error: err.message || "Erro ao validar promoção" }),
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
