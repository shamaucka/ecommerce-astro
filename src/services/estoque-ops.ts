import { eq, and, isNull, asc, desc } from "drizzle-orm"
import { db } from "../db/index.js"
import { stockLocation, stockPosition, stockMovement } from "../db/schema/estoque-ops.js"

// ========== LOCALIZACOES ==========

export async function listLocations() {
  return db
    .select()
    .from(stockLocation)
    .where(
      and(
        eq(stockLocation.active, true),
        isNull(stockLocation.deleted_at)
      )
    )
    .orderBy(asc(stockLocation.code))
}

export async function createLocation(data: { code: string; name?: string; zone?: string; capacity?: number }) {
  const result = await db
    .insert(stockLocation)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()
  return result[0]
}

// ========== POSICOES DE ESTOQUE ==========

export async function getPosition(sku: string, locationCode: string) {
  const results = await db
    .select()
    .from(stockPosition)
    .where(
      and(
        eq(stockPosition.sku, sku),
        eq(stockPosition.location_code, locationCode),
        isNull(stockPosition.deleted_at)
      )
    )
    .limit(1)
  return results[0] || null
}

export async function listPositions(filters?: { sku?: string; product_id?: string; location_code?: string }) {
  const conditions = [isNull(stockPosition.deleted_at)]
  if (filters?.sku) conditions.push(eq(stockPosition.sku, filters.sku))
  if (filters?.product_id) conditions.push(eq(stockPosition.product_id, filters.product_id))
  if (filters?.location_code) conditions.push(eq(stockPosition.location_code, filters.location_code))

  return db
    .select()
    .from(stockPosition)
    .where(and(...conditions))
    .orderBy(asc(stockPosition.sku))
    .limit(500)
}

export async function listLowStock() {
  const all = await db
    .select()
    .from(stockPosition)
    .where(isNull(stockPosition.deleted_at))
    .limit(9999)

  return all.filter((p) => (p.quantity || 0) <= (p.min_quantity || 0) && (p.min_quantity || 0) > 0)
}

// ========== MOVIMENTACOES ==========

export async function registerEntry(data: {
  sku: string
  product_id: string
  variant_id?: string
  product_title?: string
  variant_title?: string
  location_code: string
  quantity: number
  cost_price?: number
  reason?: string
  reference_type?: string
  reference_id?: string
  user_name?: string
  notes?: string
}) {
  let position = await getPosition(data.sku, data.location_code)
  const qtyBefore = position?.quantity || 0
  const qtyAfter = qtyBefore + data.quantity

  if (position) {
    await db
      .update(stockPosition)
      .set({
        quantity: qtyAfter,
        cost_price: data.cost_price ?? position.cost_price,
        product_title: data.product_title ?? position.product_title,
        variant_title: data.variant_title ?? position.variant_title,
        updated_at: new Date(),
      })
      .where(eq(stockPosition.id, position.id))
  } else {
    const result = await db
      .insert(stockPosition)
      .values({
        id: crypto.randomUUID(),
        product_id: data.product_id,
        variant_id: data.variant_id || null,
        sku: data.sku,
        product_title: data.product_title || null,
        variant_title: data.variant_title || null,
        location_code: data.location_code,
        quantity: qtyAfter,
        cost_price: data.cost_price || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning()
    position = result[0]
  }

  const movResult = await db
    .insert(stockMovement)
    .values({
      id: crypto.randomUUID(),
      position_id: position!.id,
      product_id: data.product_id,
      variant_id: data.variant_id || null,
      sku: data.sku,
      type: "entrada",
      quantity: data.quantity,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: data.reason || "Entrada manual",
      reference_type: data.reference_type || "manual",
      reference_id: data.reference_id || null,
      location_code: data.location_code,
      cost_price: data.cost_price || null,
      user_name: data.user_name || null,
      notes: data.notes || null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return { position, movement: movResult[0], quantity_before: qtyBefore, quantity_after: qtyAfter }
}

export async function registerExit(data: {
  sku: string
  location_code: string
  quantity: number
  reason?: string
  reference_type?: string
  reference_id?: string
  user_name?: string
  notes?: string
}) {
  const position = await getPosition(data.sku, data.location_code)
  if (!position) {
    throw new Error(`Posicao nao encontrada: SKU ${data.sku} em ${data.location_code}`)
  }

  const qtyBefore = position.quantity || 0
  const qtyAfter = qtyBefore - data.quantity

  if (qtyAfter < 0) {
    throw new Error(`Estoque insuficiente: SKU ${data.sku} tem ${qtyBefore}, tentou retirar ${data.quantity}`)
  }

  await db
    .update(stockPosition)
    .set({ quantity: qtyAfter, updated_at: new Date() })
    .where(eq(stockPosition.id, position.id))

  const movResult = await db
    .insert(stockMovement)
    .values({
      id: crypto.randomUUID(),
      position_id: position.id,
      product_id: position.product_id,
      variant_id: position.variant_id || null,
      sku: data.sku,
      type: "saida",
      quantity: -data.quantity,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: data.reason || "Saida manual",
      reference_type: data.reference_type || "manual",
      reference_id: data.reference_id || null,
      location_code: data.location_code,
      cost_price: position.cost_price || null,
      user_name: data.user_name || null,
      notes: data.notes || null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return {
    position: { ...position, quantity: qtyAfter },
    movement: movResult[0],
    quantity_before: qtyBefore,
    quantity_after: qtyAfter,
  }
}

export async function adjustInventory(data: {
  sku: string
  location_code: string
  new_quantity: number
  user_name?: string
  notes?: string
}) {
  const position = await getPosition(data.sku, data.location_code)
  if (!position) {
    throw new Error(`Posicao nao encontrada: SKU ${data.sku} em ${data.location_code}`)
  }

  const qtyBefore = position.quantity || 0
  const diff = data.new_quantity - qtyBefore

  await db
    .update(stockPosition)
    .set({ quantity: data.new_quantity, updated_at: new Date() })
    .where(eq(stockPosition.id, position.id))

  const movResult = await db
    .insert(stockMovement)
    .values({
      id: crypto.randomUUID(),
      position_id: position.id,
      product_id: position.product_id,
      variant_id: position.variant_id || null,
      sku: data.sku,
      type: "ajuste",
      quantity: diff,
      quantity_before: qtyBefore,
      quantity_after: data.new_quantity,
      reason: "Ajuste de inventario",
      reference_type: "inventory",
      reference_id: null,
      location_code: data.location_code,
      cost_price: position.cost_price || null,
      user_name: data.user_name || null,
      notes: data.notes || null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return {
    position: { ...position, quantity: data.new_quantity },
    movement: movResult[0],
    diff,
  }
}

export async function listMovements(filters?: {
  sku?: string
  product_id?: string
  type?: string
  location_code?: string
  limit?: number
}) {
  const conditions = [isNull(stockMovement.deleted_at)]
  if (filters?.sku) conditions.push(eq(stockMovement.sku, filters.sku))
  if (filters?.product_id) conditions.push(eq(stockMovement.product_id, filters.product_id))
  if (filters?.type) conditions.push(eq(stockMovement.type, filters.type))
  if (filters?.location_code) conditions.push(eq(stockMovement.location_code, filters.location_code))

  return db
    .select()
    .from(stockMovement)
    .where(and(...conditions))
    .orderBy(desc(stockMovement.created_at))
    .limit(filters?.limit || 100)
}

export async function getStockSummary() {
  const positions = await db
    .select()
    .from(stockPosition)
    .where(isNull(stockPosition.deleted_at))
    .limit(9999)

  const summary: Record<string, { sku: string; product_title: string; total: number; locations: any[]; cost_total: number }> = {}

  for (const p of positions) {
    const sku = p.sku || "unknown"
    if (!summary[sku]) {
      summary[sku] = {
        sku,
        product_title: p.product_title || sku,
        total: 0,
        locations: [],
        cost_total: 0,
      }
    }
    summary[sku].total += p.quantity || 0
    summary[sku].cost_total += (p.quantity || 0) * (p.cost_price || 0)
    summary[sku].locations.push({
      code: p.location_code,
      quantity: p.quantity,
      min: p.min_quantity,
    })
  }

  return Object.values(summary).sort((a, b) => a.sku.localeCompare(b.sku))
}
