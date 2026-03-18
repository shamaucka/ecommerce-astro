import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as orderService from "@/services/order";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "list": {
        const status = url.searchParams.get("status") || undefined;
        const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
        const orders = await orderService.listOrders(status, limit);
        return new Response(
          JSON.stringify({ orders }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "detail": {
        const id = url.searchParams.get("id");
        if (!id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const order = await orderService.getOrder(id);
        return new Response(
          JSON.stringify({ order }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "stats": {
        const stats = await orderService.getOrderStats();
        return new Response(
          JSON.stringify({ stats }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "list, detail, stats" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar pedidos" }),
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
      case "update_status": {
        if (!body.id || !body.status) {
          return new Response(
            JSON.stringify({ error: "id e status são obrigatórios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const order = await orderService.updateOrderStatus(body.id, body.status);
        return new Response(
          JSON.stringify({ order }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "cancel": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const order = await orderService.updateOrderStatus(body.id, "cancelled");
        return new Response(
          JSON.stringify({ order }),
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
