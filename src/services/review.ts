import { eq, and, desc, sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { productReview } from "../db/schema/review.js"

// ========== REVIEWS ==========

export async function listReviews(product_id?: string, approved?: boolean) {
  const conditions = []
  if (product_id) conditions.push(eq(productReview.product_id, product_id))
  if (approved !== undefined) conditions.push(eq(productReview.approved, approved))

  return db
    .select()
    .from(productReview)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(productReview.created_at))
}

export async function getProductReviewStats(product_id: string) {
  const result = await db
    .select({
      avg_rating: sql<number>`avg(${productReview.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(productReview)
    .where(
      and(
        eq(productReview.product_id, product_id),
        eq(productReview.approved, true)
      )
    )

  const row = result[0]
  return {
    avg_rating: row?.avg_rating ? Number(row.avg_rating) : 0,
    count: row?.count ? Number(row.count) : 0,
  }
}

export async function submitReview(data: {
  product_id: string
  customer_name: string
  customer_email: string
  rating: number
  title?: string
  comment?: string
  verified_purchase?: boolean
}) {
  const result = await db
    .insert(productReview)
    .values({
      id: crypto.randomUUID(),
      ...data,
      approved: false,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

export async function approveReview(id: string) {
  const result = await db
    .update(productReview)
    .set({ approved: true, updated_at: new Date() })
    .where(eq(productReview.id, id))
    .returning()

  if (!result[0]) throw new Error(`Review ${id} nao encontrada`)
  return result[0]
}

export async function rejectReview(id: string) {
  await db
    .delete(productReview)
    .where(eq(productReview.id, id))

  return { deleted: true }
}

export async function listPendingReviews() {
  return db
    .select()
    .from(productReview)
    .where(eq(productReview.approved, false))
    .orderBy(desc(productReview.created_at))
}
