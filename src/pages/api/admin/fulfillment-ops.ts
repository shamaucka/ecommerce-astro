import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import * as fulfillmentOps from "@/services/fulfillment-ops";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAuth(request);

    const action = url.searchParams.get("action");

    switch (action) {
      case "stats": {
        const stats = await fulfillmentOps.getStats();
        return new Response(
          JSON.stringify({ stats }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "separacao": {
        const tasks = await fulfillmentOps.getOrdersForSeparation();
        return new Response(
          JSON.stringify({ tasks }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "conferencia": {
        const tasks = await fulfillmentOps.getCheckedTasks();
        return new Response(
          JSON.stringify({ tasks }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "detail": {
        const taskId = url.searchParams.get("task_id");
        if (!taskId) {
          return new Response(
            JSON.stringify({ error: "task_id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const task = await fulfillmentOps.retrieve(taskId);
        const items = await fulfillmentOps.listFulfillmentTaskItems({ task_id: taskId });
        return new Response(
          JSON.stringify({ task: { ...task, items } }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "list": {
        const status = url.searchParams.get("status") || undefined;
        const tasks = await fulfillmentOps.list(status);
        return new Response(
          JSON.stringify({ tasks }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "romaneios_abertos": {
        const romaneios = await fulfillmentOps.listOpenRomaneios();
        return new Response(
          JSON.stringify({ romaneios }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "romaneios_todos": {
        const romaneios = await fulfillmentOps.listAllRomaneios();
        return new Response(
          JSON.stringify({ romaneios }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "romaneio_tasks": {
        const romaneioId = url.searchParams.get("romaneio_id");
        if (!romaneioId) {
          return new Response(
            JSON.stringify({ error: "romaneio_id é obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const tasks = await fulfillmentOps.getRomaneioTasks(romaneioId);
        return new Response(
          JSON.stringify({ tasks }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({
            actions: "stats, separacao, conferencia, detail, list, romaneios_abertos, romaneio_tasks",
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro na operação de fulfillment" }),
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
        const task = await fulfillmentOps.createFromOrder(body);
        return new Response(
          JSON.stringify({ task }),
          { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "print_picking_list": {
        const tasks = await fulfillmentOps.printPickingList(body.task_ids);
        return new Response(
          JSON.stringify({ tasks }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "scan_order": {
        const task = await fulfillmentOps.getTaskByOrderBarcode(body.barcode);
        return new Response(
          JSON.stringify({ task }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "check_item": {
        const { task_id: taskId, identifier } = body;

        if (!taskId || !identifier) {
          return new Response(
            JSON.stringify({ error: "task_id e identifier são obrigatórios" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const debugItems = await fulfillmentOps.listFulfillmentTaskItems({ task_id: taskId });

        const foundItem = debugItems.find(
          (i: any) =>
            i.sku === identifier || i.barcode === identifier || i.id === identifier
        );

        if (!foundItem) {
          return new Response(
            JSON.stringify({
              error: "Item não encontrado",
              identifier,
              task_id: taskId,
              available_items: debugItems.map((i: any) => ({
                id: i.id,
                sku: i.sku,
                barcode: i.barcode,
              })),
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const item = await fulfillmentOps.markItemChecked(foundItem.id);

        const allItems = await fulfillmentOps.listFulfillmentTaskItems({ task_id: taskId });
        const totalItems = allItems.length;
        const totalChecked = allItems.filter((i: any) => i.checked).length;
        const allDone = totalChecked === totalItems;

        if (allDone) {
          await fulfillmentOps.updateTaskStatus(taskId, "conferido");
        }

        return new Response(
          JSON.stringify({ item, totalChecked, totalItems, allDone }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "mark_conference_printed": {
        const task = await fulfillmentOps.markConferencePrinted(body.task_id);
        return new Response(
          JSON.stringify({ task }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "create_romaneio": {
        const romaneio = await fulfillmentOps.createRomaneio(body.carrier);
        return new Response(
          JSON.stringify({ romaneio }),
          { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "add_to_romaneio": {
        const result = await fulfillmentOps.addToRomaneio(body.romaneio_id, body.invoice_barcode);
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "remove_from_romaneio": {
        await fulfillmentOps.removeFromRomaneio(body.task_id);
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "close_romaneio": {
        const result = await fulfillmentOps.closeRomaneio(body.romaneio_id, body.closed_by);
        return new Response(
          JSON.stringify(result),
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
      JSON.stringify({ error: err.message || "Erro na operação de fulfillment" }),
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
