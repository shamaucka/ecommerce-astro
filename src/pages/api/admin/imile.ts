import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as imileService from "@/services/imile";

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create_order": {
        if (!body.data) {
          return new Response(
            JSON.stringify({ error: "data é obrigatorio" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await imileService.createOrder(body.data);
        return new Response(
          JSON.stringify({ result }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "track": {
        if (!body.waybillNo) {
          return new Response(
            JSON.stringify({ error: "waybillNo é obrigatorio" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await imileService.trackOrder(body.waybillNo);
        return new Response(
          JSON.stringify({ result }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "track_batch": {
        if (!body.waybillNos || !Array.isArray(body.waybillNos)) {
          return new Response(
            JSON.stringify({ error: "waybillNos (array) é obrigatorio" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await imileService.trackBatch(body.waybillNos);
        return new Response(
          JSON.stringify({ result }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "get_label": {
        if (!body.orderNo) {
          return new Response(
            JSON.stringify({ error: "orderNo é obrigatorio" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await imileService.getShippingLabel(body.orderNo);
        return new Response(
          JSON.stringify({ result }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "upload_invoice": {
        if (!body.waybillNo || !body.invoiceXml || !body.invoiceType || !body.accessKey) {
          return new Response(
            JSON.stringify({ error: "waybillNo, invoiceXml, invoiceType e accessKey sao obrigatorios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const result = await imileService.uploadInvoice(
          body.waybillNo,
          body.invoiceXml,
          body.invoiceType,
          body.accessKey
        );
        return new Response(
          JSON.stringify({ result }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ error: "action invalido" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao processar iMile" }),
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
