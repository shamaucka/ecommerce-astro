import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { db } from "@/db/index.js";
import { astroOrder } from "@/db/schema/order.js";
import { fulfillmentTask } from "@/db/schema/fulfillment-ops.js";
import { eq, and, desc } from "drizzle-orm";
import * as customerService from "@/services/customer";
import * as orderService from "@/services/order";

// GET /api/store/orders?action=my-orders&email=x&cpf=y
export const GET: APIRoute = async ({ url }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders };
  try {
    const action = url.searchParams.get("action");

    if (action === "my-orders") {
      const email = url.searchParams.get("email")?.trim().toLowerCase();
      const cpf = url.searchParams.get("cpf")?.replace(/\D/g, "");

      if (!email || !cpf || cpf.length !== 11) {
        return new Response(JSON.stringify({ error: "Email e CPF (11 digitos) obrigatorios" }), { status: 400, headers });
      }

      // Busca pedidos pelo email E CPF
      const orders = await db.select().from(astroOrder)
        .where(and(eq(astroOrder.customer_email, email), eq(astroOrder.customer_cpf, cpf)))
        .orderBy(desc(astroOrder.created_at))
        .limit(50);

      // Busca tracking de cada pedido
      const ordersWithTracking = await Promise.all(orders.map(async (order) => {
        let tracking = null;
        try {
          const tasks = await db.select().from(fulfillmentTask)
            .where(eq(fulfillmentTask.order_id, order.id)).limit(1);
          if (tasks[0]) {
            tracking = {
              code: tasks[0].tracking_code || order.tracking_number,
              carrier: tasks[0].carrier,
              status: tasks[0].status,
              shipped_at: tasks[0].shipped_at,
            };
          }
        } catch {}

        return {
          id: order.id,
          display_id: order.display_id,
          status: order.status,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          items: order.items,
          subtotal: order.subtotal,
          shipping_cost: order.shipping_cost,
          discount_amount: order.discount_amount,
          total: order.total,
          coupon_code: order.coupon_code,
          tracking_number: tracking?.code || order.tracking_number,
          tracking_url: order.tracking_url,
          tracking,
          shipping_city: order.shipping_city,
          shipping_state: order.shipping_state,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      }));

      return new Response(JSON.stringify({ orders: ordersWithTracking }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "action invalido" }), { status: 400, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { email, name, cpf, phone, items, shipping, payment, subtotal_override, discount_amount, tracking_data } = body;
        // Captura IP do cliente para CAPI
        const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || undefined;
        if (!email || !items) {
          return new Response(
            JSON.stringify({ error: "email e items são obrigatórios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // subtotal: usa override do front (com promo) ou calcula dos itens
        const subtotal = subtotal_override || items.reduce((s: number, i: any) => s + (i.unit_price || 0) * (i.quantity || 1), 0);
        const discount = discount_amount || 0;

        const customer = await customerService.getOrCreateByEmail(email, { name, phone });
        const order = await orderService.createOrder({
          customer_id: customer.id,
          customer_name: name,
          customer_email: email,
          customer_phone: phone || "",
          customer_cpf: cpf ? cpf.replace(/\D/g, "") : "",
          items,
          subtotal,
          discount_amount: discount,
          shipping_cost: shipping?.cost || 0,
          shipping_address_line1: shipping?.address_line1,
          shipping_address_line2: shipping?.address_line2,
          shipping_neighborhood: shipping?.neighborhood,
          shipping_city: shipping?.city,
          shipping_state: shipping?.state,
          shipping_postal_code: shipping?.postal_code,
          metadata: {
            cpf: cpf || "",
            phone: phone || "",
            promo: discount > 0 ? "2por150" : undefined,
            // Dados para CAPI nos webhooks (fbp, fbc, ip, ua)
            fbp: tracking_data?.fbp || undefined,
            fbc: tracking_data?.fbc || undefined,
            client_ip: clientIp || undefined,
            client_ua: tracking_data?.user_agent || undefined,
            purchase_event_id: tracking_data?.purchase_event_id || undefined,
          },
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
