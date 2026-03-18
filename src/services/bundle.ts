import { eq, desc } from "drizzle-orm"
import { db } from "../db/index.js"
import { productBundle } from "../db/schema/bundle.js"
import {
  astroProduct,
  astroProductVariant,
  astroVariantPrice,
} from "../db/schema/product.js"

// ========== BUNDLES ==========

export async function getBundlesForProduct(product_id: string) {
  const bundles = await db
    .select()
    .from(productBundle)
    .where(eq(productBundle.product_id, product_id))
    .orderBy(productBundle.position)

  const result = []
  for (const bundle of bundles) {
    const products = await db
      .select()
      .from(astroProduct)
      .where(eq(astroProduct.id, bundle.related_product_id))
      .limit(1)

    const relatedProduct = products[0]
    if (!relatedProduct) continue

    const variants = await db
      .select()
      .from(astroProductVariant)
      .where(eq(astroProductVariant.product_id, relatedProduct.id))

    const variantsWithPrices = []
    for (const variant of variants) {
      const prices = await db
        .select()
        .from(astroVariantPrice)
        .where(eq(astroVariantPrice.variant_id, variant.id))
      variantsWithPrices.push({ ...variant, prices })
    }

    result.push({
      ...bundle,
      related_product: { ...relatedProduct, variants: variantsWithPrices },
    })
  }

  return result
}

export async function createBundle(data: {
  product_id: string
  related_product_id: string
  discount_percent?: number
  position?: number
  active?: boolean
}) {
  const result = await db
    .insert(productBundle)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

export async function updateBundle(id: string, data: Record<string, any>) {
  const result = await db
    .update(productBundle)
    .set({ ...data, updated_at: new Date() })
    .where(eq(productBundle.id, id))
    .returning()

  if (!result[0]) throw new Error(`Bundle ${id} nao encontrado`)
  return result[0]
}

export async function deleteBundle(id: string) {
  await db
    .delete(productBundle)
    .where(eq(productBundle.id, id))

  return { deleted: true }
}

export async function listBundles() {
  const bundles = await db
    .select()
    .from(productBundle)
    .orderBy(desc(productBundle.created_at))

  const result = []
  for (const bundle of bundles) {
    const sourceProducts = await db
      .select({ title: astroProduct.title })
      .from(astroProduct)
      .where(eq(astroProduct.id, bundle.product_id))
      .limit(1)

    const relatedProducts = await db
      .select({ title: astroProduct.title })
      .from(astroProduct)
      .where(eq(astroProduct.id, bundle.related_product_id))
      .limit(1)

    result.push({
      ...bundle,
      product_title: sourceProducts[0]?.title || null,
      related_product_title: relatedProducts[0]?.title || null,
    })
  }

  return result
}
