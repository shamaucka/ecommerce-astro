import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import * as customerService from "@/services/customer";
import * as orderService from "@/services/order";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { email, name, items, shipping, payment } = body;
        if (!email || !items) {
          return new Response(
            JSON.stringify({ error: "email e items são obrigatórios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const customer = await customerService.getOrCreateByEmail(email, { name });
        const order = await orderService.createOrder({
          customer_id: customer.id,
          items,
          shipping,
          payment,
        });

        return new Response(
          JSON.stringify({ order }),
          { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
      JSON.stringify({ error: err.message || "Erro ao processar pedido" }),
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
