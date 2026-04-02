import type { APIRoute } from "astro"
import { corsHeaders } from "@/lib/cors"
import { db } from "@/db/index.js"
import { sql } from "drizzle-orm"
import { requireAuth } from "@/services/auth"

/**
 * Atualiza o ranking de vendas (sales_count) de todos os produtos.
 * Deve ser chamado diariamente via cron ou manualmente.
 *
 * GET /api/admin/update-sales-ranking (autenticado)
 * POST /api/admin/update-sales-ranking (com cron secret)
 */

async function updateSalesRanking() {
  // Reset todos para 0
  await db.execute(sql`UPDATE astro_product SET sales_count = 0`)

  // Atualiza com vendas reais (pedidos pagos)
  // Match por handle (slug) OU por SKU da variante
  const result = await db.execute(sql`
    UPDATE astro_product p SET sales_count = COALESCE(s.total, 0)
    FROM (
      SELECT item->>'sku' as sku, SUM((item->>'quantity')::int) as total
      FROM astro_order, jsonb_array_elements(items::jsonb) as item
      WHERE payment_status = 'paid'
      GROUP BY item->>'sku'
    ) s
    WHERE p.handle = s.sku OR EXISTS (
      SELECT 1 FROM astro_product_variant v WHERE v.product_id = p.id AND v.sku = s.sku
    )
  `)

  // Contar quantos foram atualizados
  const stats = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE sales_count > 0) as with_sales,
           SUM(sales_count) as total_sales
    FROM astro_product
  `)

  const row = (stats as any).rows?.[0] || {}
  console.log(`[update-sales-ranking] ${row.with_sales} products with sales, ${row.total_sales} total items sold`)

  return {
    products_with_sales: Number(row.with_sales || 0),
    total_items_sold: Number(row.total_sales || 0),
  }
}

export const GET: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    await requireAuth(request)
    const result = await updateSalesRanking()
    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json", ...corsHeaders }
  try {
    const body = await request.json()
    const cronSecret = process.env.CRON_SECRET || "tess-cron-2026"
    if (body.secret !== cronSecret) {
      return new Response(JSON.stringify({ error: "invalid secret" }), { status: 401, headers })
    }
    const result = await updateSalesRanking()
    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
