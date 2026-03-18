import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as customerService from "@/services/customer";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "list": {
        const search = url.searchParams.get("search") || undefined;
        const customers = await customerService.listCustomers(search);
        return new Response(
          JSON.stringify({ customers }),
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
        const customer = await customerService.getCustomer(id);
        return new Response(
          JSON.stringify({ customer }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "list, detail" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar clientes" }),
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
      case "update": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const customer = await customerService.updateCustomer(body.id, body);
        return new Response(
          JSON.stringify({ customer }),
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
      JSON.stringify({ error: err.message || "Erro ao processar cliente" }),
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
