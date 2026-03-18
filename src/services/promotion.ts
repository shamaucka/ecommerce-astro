import { eq, and, sql, desc } from "drizzle-orm"
import { db } from "../db/index.js"
import { promotion } from "../db/schema/promotion.js"

// ========== PROMOTIONS ==========

export async function listPromotions() {
  return db
    .select()
    .from(promotion)
    .orderBy(desc(promotion.created_at))
}

export async function createPromotion(data: {
  name: string
  type?: string
  code?: string
  discount_type?: string
  discount_value: number
  min_purchase?: number
  category_id?: string
  min_items?: number
  max_uses?: number
  active?: boolean
  valid_from?: Date
  valid_until?: Date
}) {
  const result = await db
    .insert(promotion)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

export async function updatePromotion(id: string, data: Record<string, any>) {
  const result = await db
    .update(promotion)
    .set({ ...data, updated_at: new Date() })
    .where(eq(promotion.id, id))
    .returning()

  if (!result[0]) throw new Error(`Promocao ${id} nao encontrada`)
  return result[0]
}

export async function deletePromotion(id: string) {
  await db
    .delete(promotion)
    .where(eq(promotion.id, id))

  return { deleted: true }
}

export async function validateCoupon(code: string, cartTotal: number, cartItems?: any[]) {
  const results = await db
    .select()
    .from(promotion)
    .where(eq(promotion.code, code))
    .limit(1)

  const promo = results[0]
  if (!promo) throw new Error(`Cupom "${code}" nao encontrado`)
  if (!promo.active) throw new Error(`Cupom "${code}" esta inativo`)

  const now = new Date()
  if (promo.valid_from && now < new Date(promo.valid_from)) {
    throw new Error(`Cupom "${code}" ainda nao esta valido`)
  }
  if (promo.valid_until && now > new Date(promo.valid_until)) {
    throw new Error(`Cupom "${code}" expirou`)
  }

  if (promo.min_purchase && cartTotal < promo.min_purchase) {
    throw new Error(
      `Valor minimo do pedido para este cupom: R$ ${(promo.min_purchase / 100).toFixed(2)}`
    )
  }

  if (promo.max_uses && (promo.used_count || 0) >= promo.max_uses) {
    throw new Error(`Cupom "${code}" atingiu o limite de uso`)
  }

  if (promo.min_items && cartItems && cartItems.length < promo.min_items) {
    throw new Error(`Este cupom exige no minimo ${promo.min_items} itens no carrinho`)
  }

  let discountAmount = 0
  if (promo.discount_type === "percentage") {
    discountAmount = Math.round(cartTotal * (promo.discount_value / 100))
  } else {
    discountAmount = promo.discount_value
  }

  return {
    valid: true,
    promotion_id: promo.id,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    discount_amount: discountAmount,
  }
}

export async function applyCoupon(code: string) {
  const result = await db
    .update(promotion)
    .set({
      used_count: sql`${promotion.used_count} + 1`,
      updated_at: new Date(),
    })
    .where(eq(promotion.code, code))
    .returning()

  if (!result[0]) throw new Error(`Cupom "${code}" nao encontrado`)
  return result[0]
}
