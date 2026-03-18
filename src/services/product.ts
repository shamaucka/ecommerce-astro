import { eq, desc } from "drizzle-orm"
import { db } from "../db/index.js"
import {
  astroProduct,
  astroProductVariant,
  astroVariantPrice,
  astroRegion,
} from "../db/schema/product.js"

// ========== PRODUCTS ==========

export async function listProducts(limit = 100) {
  const products = await db
    .select()
    .from(astroProduct)
    .orderBy(desc(astroProduct.created_at))
    .limit(limit)

  const result = []
  for (const product of products) {
    const variants = await db
      .select()
      .from(astroProductVariant)
      .where(eq(astroProductVariant.product_id, product.id))

    const variantsWithPrices = []
    for (const variant of variants) {
      const prices = await db
        .select()
        .from(astroVariantPrice)
        .where(eq(astroVariantPrice.variant_id, variant.id))
      variantsWithPrices.push({ ...variant, prices })
    }

    result.push({ ...product, variants: variantsWithPrices })
  }

  return result
}

export async function getProduct(id: string) {
  const products = await db
    .select()
    .from(astroProduct)
    .where(eq(astroProduct.id, id))
    .limit(1)

  const product = products[0]
  if (!product) throw new Error(`Produto ${id} nao encontrado`)

  const variants = await db
    .select()
    .from(astroProductVariant)
    .where(eq(astroProductVariant.product_id, product.id))

  const variantsWithPrices = []
  for (const variant of variants) {
    const prices = await db
      .select()
      .from(astroVariantPrice)
      .where(eq(astroVariantPrice.variant_id, variant.id))
    variantsWithPrices.push({ ...variant, prices })
  }

  return { ...product, variants: variantsWithPrices }
}

export async function createProduct(data: {
  title: string
  handle: string
  subtitle?: string
  description?: string
  status?: string
  weight?: number
  length?: number
  width?: number
  height?: number
  material?: string
  origin_country?: string
  mid_code?: string
  hs_code?: string
  thumbnail?: string
  images?: any[]
  metadata?: any
  variants?: Array<{
    title?: string
    sku: string
    barcode?: string
    ean?: string
    manage_inventory?: boolean
    options?: any
    prices?: Array<{
      amount: number
      currency_code?: string
    }>
  }>
}) {
  const { variants: variantsData, ...productData } = data

  const productResult = await db
    .insert(astroProduct)
    .values({
      id: crypto.randomUUID(),
      ...productData,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  const product = productResult[0]

  const createdVariants = []
  if (variantsData) {
    for (const variantInput of variantsData) {
      const { prices: pricesData, ...variantData } = variantInput

      const variantResult = await db
        .insert(astroProductVariant)
        .values({
          id: crypto.randomUUID(),
          product_id: product.id,
          ...variantData,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning()

      const variant = variantResult[0]

      const createdPrices = []
      if (pricesData) {
        for (const priceInput of pricesData) {
          const priceResult = await db
            .insert(astroVariantPrice)
            .values({
              id: crypto.randomUUID(),
              variant_id: variant.id,
              amount: priceInput.amount,
              currency_code: priceInput.currency_code || "brl",
              created_at: new Date(),
            })
            .returning()
          createdPrices.push(priceResult[0])
        }
      }

      createdVariants.push({ ...variant, prices: createdPrices })
    }
  }

  return { ...product, variants: createdVariants }
}

export async function updateProduct(id: string, data: Record<string, any>) {
  const result = await db
    .update(astroProduct)
    .set({ ...data, updated_at: new Date() })
    .where(eq(astroProduct.id, id))
    .returning()

  if (!result[0]) throw new Error(`Produto ${id} nao encontrado`)
  return result[0]
}

export async function deleteProduct(id: string) {
  // Delete prices for all variants
  const variants = await db
    .select()
    .from(astroProductVariant)
    .where(eq(astroProductVariant.product_id, id))

  for (const variant of variants) {
    await db
      .delete(astroVariantPrice)
      .where(eq(astroVariantPrice.variant_id, variant.id))
  }

  // Delete variants
  await db
    .delete(astroProductVariant)
    .where(eq(astroProductVariant.product_id, id))

  // Delete product
  await db
    .delete(astroProduct)
    .where(eq(astroProduct.id, id))

  return { deleted: true }
}

// ========== REGIONS ==========

export async function listRegions() {
  return db
    .select()
    .from(astroRegion)
    .orderBy(astroRegion.name)
}
