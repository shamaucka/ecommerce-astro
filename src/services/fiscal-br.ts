import { eq, and, isNull, inArray } from "drizzle-orm"
import { db } from "../db/index.js"
import { productFiscal, storeFiscalConfig } from "../db/schema/fiscal-br.js"

// ========== CONFIG GLOBAL DA LOJA ==========

export async function getStoreConfig() {
  const results = await db
    .select()
    .from(storeFiscalConfig)
    .where(isNull(storeFiscalConfig.deleted_at))
    .limit(1)
  return results[0] || null
}

export async function upsertStoreConfig(data: Record<string, any>) {
  const existing = await getStoreConfig()
  if (existing) {
    const result = await db
      .update(storeFiscalConfig)
      .set({ ...data, updated_at: new Date() })
      .where(eq(storeFiscalConfig.id, existing.id))
      .returning()
    return result[0]
  } else {
    const result = await db
      .insert(storeFiscalConfig)
      .values({
        id: crypto.randomUUID(),
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning()
    return result[0]
  }
}

// ========== FISCAL POR PRODUTO ==========

export async function getByProductId(productId: string) {
  const results = await db
    .select()
    .from(productFiscal)
    .where(
      and(
        eq(productFiscal.product_id, productId),
        isNull(productFiscal.deleted_at)
      )
    )
    .limit(1)
  return results[0] || null
}

export async function upsertFiscal(productId: string, data: Record<string, any>) {
  const existing = await getByProductId(productId)
  if (existing) {
    const result = await db
      .update(productFiscal)
      .set({ ...data, updated_at: new Date() })
      .where(eq(productFiscal.id, existing.id))
      .returning()
    return result[0]
  } else {
    const result = await db
      .insert(productFiscal)
      .values({
        id: crypto.randomUUID(),
        product_id: productId,
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning()
    return result[0]
  }
}

export async function getByProductIds(productIds: string[]) {
  const results = await db
    .select()
    .from(productFiscal)
    .where(
      and(
        inArray(productFiscal.product_id, productIds),
        isNull(productFiscal.deleted_at)
      )
    )
    .limit(productIds.length)

  const map: Record<string, any> = {}
  for (const r of results) {
    if (r.product_id) {
      map[r.product_id] = r
    }
  }
  return map
}

export async function listIncomplete() {
  const all = await db
    .select()
    .from(productFiscal)
    .where(isNull(productFiscal.deleted_at))
    .limit(9999)

  return all.filter((f) => !f.ncm || !f.cfop_dentro_estado || !f.cst_icms)
}
