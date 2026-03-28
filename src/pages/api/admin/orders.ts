import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as orderService from "@/services/order";
import * as customerService from "@/services/customer";

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

      case "create": {
        const { cliente, itens } = body;
        if (!cliente?.nome?.trim() || !itens?.length) {
          return new Response(
            JSON.stringify({ error: "nome e itens são obrigatórios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const email = cliente.email?.trim() || `manual+${Date.now()}@interno`;
        const customer = await customerService.getOrCreateByEmail(email, {
          name: cliente.nome.trim(),
          phone: cliente.telefone || "",
          cpf: (cliente.cpf_cnpj || "").replace(/\D/g, ""),
        });

        const subtotal = (itens as any[]).reduce(
          (s: number, i: any) => s + (Number(i.valor) || 0) * (Number(i.qtde) || 1),
          0
        );

        const endereco = cliente.endereco || {};
        const order = await orderService.createOrder({
          customer_id: customer.id,
          customer_name: cliente.nome.trim(),
          customer_email: email,
          customer_phone: cliente.telefone || "",
          customer_cpf: (cliente.cpf_cnpj || "").replace(/\D/g, ""),
          items: (itens as any[]).map((i: any) => ({
            sku: i.sku,
            title: i.titulo_produto || i.sku,
            quantity: Number(i.qtde) || 1,
            unit_price: Number(i.valor) || 0,
          })),
          subtotal,
          shipping_cost: 0,
          payment_method: "manual",
          shipping_address_line1: endereco.logradouro || "",
          shipping_address_line2: endereco.complemento || "",
          shipping_neighborhood: endereco.bairro || "",
          shipping_city: endereco.cidade || "",
          shipping_state: endereco.estado || "",
          shipping_postal_code: (endereco.cep || "").replace(/\D/g, ""),
          metadata: { source: "admin_manual" },
        });

        return new Response(
          JSON.stringify({ ok: true, order }),
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
