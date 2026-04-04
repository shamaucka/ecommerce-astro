import { db } from "../db/index.js"
import { sql } from "drizzle-orm"

// ========== OVERVIEW KPIs ==========

export async function getOverviewKPIs(days = 30) {
  const r = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'paid') as total_orders,
      COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0) as revenue,
      COALESCE(AVG(total) FILTER (WHERE payment_status = 'paid'), 0) as avg_ticket,
      COUNT(DISTINCT customer_id) FILTER (WHERE payment_status = 'paid') as unique_customers,
      COUNT(*) FILTER (WHERE payment_status = 'paid' AND created_at >= NOW() - INTERVAL '1 day') as orders_today,
      COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid' AND created_at >= NOW() - INTERVAL '1 day'), 0) as revenue_today,
      COALESCE(SUM(discount_amount) FILTER (WHERE payment_status = 'paid'), 0) as total_discounts,
      COALESCE(SUM(shipping_cost) FILTER (WHERE payment_status = 'paid'), 0) as total_shipping,
      COUNT(DISTINCT customer_id) FILTER (WHERE payment_status = 'paid' AND customer_id IN (
        SELECT customer_id FROM astro_order WHERE payment_status = 'paid' GROUP BY customer_id HAVING COUNT(*) > 1
      )) as repeat_customers,
      COUNT(*) as total_orders_all
    FROM astro_order
    WHERE created_at >= NOW() - MAKE_INTERVAL(days => ${days})
  `)
  return (r as any).rows?.[0] || {}
}

// ========== VENDAS POR DIA ==========

export async function getSalesByDay(days = 30) {
  const r = await db.execute(sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) FILTER (WHERE payment_status = 'paid') as orders,
      COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0) as revenue,
      COUNT(*) as total_created
    FROM astro_order
    WHERE created_at >= NOW() - MAKE_INTERVAL(days => ${days})
    GROUP BY DATE(created_at)
    ORDER BY date
  `)
  return (r as any).rows || []
}

// ========== PEDIDOS POR STATUS ==========

export async function getOrdersByStatus() {
  const r = await db.execute(sql`
    SELECT status, payment_status, COUNT(*) as count
    FROM astro_order
    GROUP BY status, payment_status
    ORDER BY count DESC
  `)
  return (r as any).rows || []
}

// ========== PEDIDOS POR METODO PAGAMENTO ==========

export async function getOrdersByPaymentMethod(days = 30) {
  const r = await db.execute(sql`
    SELECT
      COALESCE(payment_method, 'indefinido') as method,
      COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue
    FROM astro_order
    WHERE payment_status = 'paid' AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
    GROUP BY payment_method
    ORDER BY revenue DESC
  `)
  return (r as any).rows || []
}

// ========== TOP PRODUTOS ==========

export async function getTopProducts(limit = 20) {
  const r = await db.execute(sql`
    SELECT
      item->>'title' as name,
      COALESCE(v.sku, item->>'sku') as sku,
      SUM((item->>'quantity')::int) as qty_sold,
      SUM((item->>'unit_price')::int * (item->>'quantity')::int) as revenue
    FROM astro_order o, jsonb_array_elements(o.items::jsonb) as item
    LEFT JOIN astro_product p ON p.handle = item->>'sku'
    LEFT JOIN astro_product_variant v ON v.product_id = p.id
    WHERE o.payment_status = 'paid'
    GROUP BY item->>'title', COALESCE(v.sku, item->>'sku')
    ORDER BY revenue DESC
    LIMIT ${limit}
  `)
  return (r as any).rows || []
}

// ========== DISTRIBUICAO GEOGRAFICA ==========

export async function getGeoDistribution(days = 90) {
  const r = await db.execute(sql`
    SELECT
      COALESCE(shipping_state, 'N/A') as state,
      COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue
    FROM astro_order
    WHERE payment_status = 'paid' AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
    GROUP BY shipping_state
    ORDER BY revenue DESC
  `)
  return (r as any).rows || []
}

// ========== RFM ANALYSIS ==========

export async function getRFMAnalysis() {
  const r = await db.execute(sql`
    WITH customer_rfm AS (
      SELECT
        customer_id,
        customer_name,
        customer_email,
        MAX(created_at) as last_order,
        COUNT(*) as frequency,
        SUM(total) as monetary,
        EXTRACT(DAY FROM NOW() - MAX(created_at)) as recency_days
      FROM astro_order
      WHERE payment_status = 'paid' AND customer_id IS NOT NULL
      GROUP BY customer_id, customer_name, customer_email
    ),
    rfm_scores AS (
      SELECT *,
        CASE
          WHEN recency_days <= 30 THEN 3
          WHEN recency_days <= 90 THEN 2
          ELSE 1
        END as r_score,
        CASE
          WHEN frequency >= 3 THEN 3
          WHEN frequency >= 2 THEN 2
          ELSE 1
        END as f_score,
        CASE
          WHEN monetary >= 30000 THEN 3
          WHEN monetary >= 15000 THEN 2
          ELSE 1
        END as m_score
      FROM customer_rfm
    )
    SELECT *,
      CASE
        WHEN r_score >= 3 AND f_score >= 3 THEN 'campeoes'
        WHEN f_score >= 2 AND m_score >= 2 THEN 'leais'
        WHEN r_score >= 3 AND f_score = 1 THEN 'recentes'
        WHEN r_score = 2 AND f_score >= 2 THEN 'atencao'
        WHEN r_score = 1 AND f_score >= 2 THEN 'em_risco'
        ELSE 'inativos'
      END as segment
    FROM rfm_scores
    ORDER BY monetary DESC
  `)
  return (r as any).rows || []
}

// ========== COHORT MENSAL ==========

export async function getCohortAnalysis() {
  const r = await db.execute(sql`
    WITH first_orders AS (
      SELECT customer_id, DATE_TRUNC('month', MIN(created_at)) as cohort_month
      FROM astro_order
      WHERE payment_status = 'paid' AND customer_id IS NOT NULL
      GROUP BY customer_id
    ),
    order_months AS (
      SELECT o.customer_id, f.cohort_month, DATE_TRUNC('month', o.created_at) as order_month
      FROM astro_order o
      JOIN first_orders f ON o.customer_id = f.customer_id
      WHERE o.payment_status = 'paid'
    )
    SELECT
      cohort_month,
      EXTRACT(MONTH FROM order_month - cohort_month) as months_after,
      COUNT(DISTINCT customer_id) as customers
    FROM order_months
    GROUP BY cohort_month, months_after
    ORDER BY cohort_month, months_after
  `)
  return (r as any).rows || []
}

// ========== DRE FINANCEIRO ==========

export async function getDRE(days = 30) {
  const CUSTO_PRODUTO = 1200  // R$12,00 por quadro (centavos)
  const CUSTO_FRETE = 1200    // R$12,00 por pedido (centavos)

  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(total), 0) as receita_bruta,
      COALESCE(SUM(discount_amount), 0) as descontos,
      COALESCE(SUM(shipping_cost), 0) as frete_cobrado,
      COALESCE(SUM(CASE WHEN payment_method = 'pix' THEN ROUND(total * 0.01) ELSE 0 END), 0) as taxa_pix,
      COALESCE(SUM(CASE WHEN payment_method = 'credit_card' THEN ROUND(total * 0.045) ELSE 0 END), 0) as taxa_cartao,
      COALESCE(SUM(ROUND(total * 0.0365)), 0) as pis_cofins,
      COUNT(*) as total_pedidos,
      COUNT(DISTINCT customer_id) as total_clientes,
      COALESCE(SUM(jsonb_array_length(items::jsonb)), 0) as total_itens
    FROM astro_order
    WHERE payment_status = 'paid' AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
  `)
  const row = (r as any).rows?.[0] || {}
  // Adicionar custos calculados
  row.custo_produto = Number(row.total_itens || 0) * CUSTO_PRODUTO
  row.custo_frete_envio = Number(row.total_pedidos || 0) * CUSTO_FRETE
  return row
}

// ========== PROMOCOES PERFORMANCE ==========

export async function getPromoPerformance(days = 90) {
  const r = await db.execute(sql`
    SELECT
      COALESCE(coupon_code, 'sem_cupom') as coupon,
      COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue,
      COALESCE(SUM(discount_amount), 0) as discount_given
    FROM astro_order
    WHERE payment_status = 'paid' AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
    GROUP BY coupon_code
    ORDER BY orders DESC
  `)
  return (r as any).rows || []
}

// ========== VENDAS POR HORA ==========

export async function getSalesByHour(days = 30) {
  const r = await db.execute(sql`
    SELECT
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo') as hour,
      COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue
    FROM astro_order
    WHERE payment_status = 'paid' AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
    GROUP BY hour
    ORDER BY hour
  `)
  return (r as any).rows || []
}

// ========== META ADS (Facebook/Instagram) ==========

export async function getMetaAdsInsights(days = 30) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  const accessToken = process.env.META_CAPI_TOKEN

  if (!adAccountId || !accessToken) {
    return { error: "META_AD_ACCOUNT_ID ou META_CAPI_TOKEN nao configurado" }
  }

  try {
    const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0]
    const until = new Date().toISOString().split("T")[0]

    const url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`

    const res = await fetch(url)
    const data = await res.json()

    if (data.error) {
      console.error("[Meta Ads]", data.error.message)
      return { error: data.error.message }
    }

    // Processar dados
    const daily = (data.data || []).map((d: any) => {
      const purchases = (d.actions || []).find((a: any) => a.action_type === "purchase")
      const purchaseValue = (d.action_values || []).find((a: any) => a.action_type === "purchase")
      return {
        date: d.date_start,
        spend: parseFloat(d.spend || 0),
        impressions: parseInt(d.impressions || 0),
        clicks: parseInt(d.clicks || 0),
        ctr: parseFloat(d.ctr || 0),
        cpc: parseFloat(d.cpc || 0),
        cpm: parseFloat(d.cpm || 0),
        purchases: parseInt(purchases?.value || 0),
        purchase_value: parseFloat(purchaseValue?.value || 0),
        roas: parseFloat(d.spend) > 0 ? parseFloat(purchaseValue?.value || 0) / parseFloat(d.spend) : 0,
      }
    })

    // Totais
    const totals = daily.reduce((acc: any, d: any) => ({
      spend: acc.spend + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      purchases: acc.purchases + d.purchases,
      purchase_value: acc.purchase_value + d.purchase_value,
    }), { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0 })

    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0
    totals.cpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0
    totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0
    totals.roas = totals.spend > 0 ? (totals.purchase_value / totals.spend) : 0
    totals.cpa = totals.purchases > 0 ? (totals.spend / totals.purchases) : 0

    return { daily, totals }
  } catch (e: any) {
    console.error("[Meta Ads] Error:", e.message)
    return { error: e.message }
  }
}
