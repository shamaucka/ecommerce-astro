import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as reviewService from "@/services/review";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "list": {
        const product_id = url.searchParams.get("product_id") || undefined;
        const approved = url.searchParams.get("approved") !== null
          ? url.searchParams.get("approved") === "true"
          : undefined;
        const page = parseInt(url.searchParams.get("page") || "0");
        const limit = parseInt(url.searchParams.get("limit") || "0");

        if (page > 0 && limit > 0) {
          const result = await reviewService.listAllReviews(approved, page, limit);
          return new Response(
            JSON.stringify({ reviews: result }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const reviews = await reviewService.listReviews(product_id, approved);
        return new Response(
          JSON.stringify({ reviews }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "pending": {
        const reviews = await reviewService.listPendingReviews();
        return new Response(
          JSON.stringify({ reviews }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ actions: "list, pending" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar avaliações" }),
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
      case "approve": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const review = await reviewService.approveReview(body.id);
        return new Response(
          JSON.stringify({ review }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "reject": {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: "id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const review = await reviewService.rejectReview(body.id);
        return new Response(
          JSON.stringify({ review }),
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
      JSON.stringify({ error: err.message || "Erro ao processar avaliação" }),
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
