import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import * as reviewService from "@/services/review";

export const GET: APIRoute = async ({ url }) => {
  try {
    const product_id = url.searchParams.get("product_id");
    if (!product_id) {
      return new Response(
        JSON.stringify({ error: "product_id é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const reviews = await reviewService.listReviews(product_id, true);
    const stats = await reviewService.getProductReviewStats(product_id);

    return new Response(
      JSON.stringify({ reviews, stats }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao buscar avaliações" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "submit": {
        const { customer_name, customer_email, product_id, rating, comment } = body;
        if (!customer_name || !customer_email || !product_id || !rating || !comment) {
          return new Response(
            JSON.stringify({ error: "customer_name, customer_email, product_id, rating e comment são obrigatórios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const review = await reviewService.submitReview({ customer_name, customer_email, product_id, rating, comment });
        return new Response(
          JSON.stringify({ review }),
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
