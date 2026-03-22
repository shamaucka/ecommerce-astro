import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as bundleService from "@/services/bundle";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "list": {
        const bundles = await bundleService.listBundles();
        return new Response(
          JSON.stringify({ bundles }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "for_product": {
        const product_id = url.searchParams.get("product_id");
        if (!product_id) {
          return new Response(
            JSON.stringify({ error: "product_id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const bundles = await bundleService.getBundlesForProduct(product_id);
        return new Response(
          JSON.stringify({ bundles }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "list, for_product" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar kits" }),
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
      case "create": {
        // Suporta formato do dashboard: { product_id, related_products: [{ product_id, discount_percent }] }
        if (body.related_products && Array.isArray(body.related_products)) {
          const bundles = [];
          for (const rp of body.related_products) {
            const bundle = await bundleService.createBundle({
              product_id: body.product_id,
              related_product_id: rp.product_id,
              discount_percent: rp.discount_percent || 0,
            });
            bundles.push(bundle);
          }
          return new Response(
            JSON.stringify({ bundles, bundle: bundles[0] }),
            { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        // Formato direto: { product_id, related_product_id, discount_percent }
        const bundle = await bundleService.createBundle(body);
        return new Response(
          JSON.stringify({ bundle }),
          { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "update": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const bundle = await bundleService.updateBundle(body.id, body);
        return new Response(
          JSON.stringify({ bundle }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "delete": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        await bundleService.deleteBundle(body.id);
        return new Response(
          JSON.stringify({ success: true }),
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
      JSON.stringify({ error: err.message || "Erro ao processar kit" }),
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
