import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as categoryService from "@/services/category";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "list": {
        const categories = await categoryService.listCategories();
        return new Response(
          JSON.stringify({ categories }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "tree": {
        const tree = await categoryService.getCategoryTree();
        return new Response(
          JSON.stringify({ tree }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "list, tree" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar categorias" }),
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
        const category = await categoryService.createCategory(body);
        return new Response(
          JSON.stringify({ category }),
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
        const category = await categoryService.updateCategory(body.id, body);
        return new Response(
          JSON.stringify({ category }),
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
        await categoryService.deleteCategory(body.id);
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
      JSON.stringify({ error: err.message || "Erro ao processar categoria" }),
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
