import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { requireAuth } from "@/services/auth"
import * as analytics from "@/services/analytics"

export const GET: APIRoute = async ({ request, url }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    await requireAuth(request)
    const action = url.searchParams.get("action") || "overview"
    const days = parseInt(url.searchParams.get("days") || "30")

    switch (action) {
      case "overview":
        return json({ kpis: await analytics.getOverviewKPIs(days) }, headers)

      case "sales-by-day":
        return json({ data: await analytics.getSalesByDay(days) }, headers)

      case "orders-by-status":
        return json({ data: await analytics.getOrdersByStatus() }, headers)

      case "orders-by-payment":
        return json({ data: await analytics.getOrdersByPaymentMethod(days) }, headers)

      case "top-products":
        return json({ data: await analytics.getTopProducts(parseInt(url.searchParams.get("limit") || "20")) }, headers)

      case "geo":
        return json({ data: await analytics.getGeoDistribution(days) }, headers)

      case "rfm":
        return json({ data: await analytics.getRFMAnalysis() }, headers)

      case "cohort":
        return json({ data: await analytics.getCohortAnalysis() }, headers)

      case "dre": {
        const month = url.searchParams.get("month") || undefined
        return json({ data: await analytics.getDRE(days, month) }, headers)
      }

      case "promos":
        return json({ data: await analytics.getPromoPerformance(days) }, headers)

      case "sales-by-hour":
        return json({ data: await analytics.getSalesByHour(days) }, headers)

      case "meta-ads":
        return json({ data: await analytics.getMetaAdsInsights(days) }, headers)

      case "stock":
        return json({ data: await analytics.getStockAnalysis() }, headers)

      case "all": {
        const [kpis, salesByDay, ordersByStatus, ordersByPayment, topProducts, geo, dre, salesByHour] = await Promise.all([
          analytics.getOverviewKPIs(days),
          analytics.getSalesByDay(days),
          analytics.getOrdersByStatus(),
          analytics.getOrdersByPaymentMethod(days),
          analytics.getTopProducts(10),
          analytics.getGeoDistribution(days),
          analytics.getDRE(days),
          analytics.getSalesByHour(days),
        ])
        return json({ kpis, salesByDay, ordersByStatus, ordersByPayment, topProducts, geo, dre, salesByHour }, headers)
      }

      default:
        return json({ error: "action invalido", actions: "overview, sales-by-day, orders-by-status, orders-by-payment, top-products, geo, rfm, cohort, dre, promos, sales-by-hour, meta-ads, all" }, headers)
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

function json(data: any, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), { status: 200, headers })
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
