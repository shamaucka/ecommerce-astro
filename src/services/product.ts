import { eq, desc, inArray, sql, ne } from "drizzle-orm"
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

  if (products.length === 0) return []

  const productIds = products.map((p) => p.id)

  const allVariants = await db
    .select()
    .from(astroProductVariant)
    .where(inArray(astroProductVariant.product_id, productIds))

  const variantIds = allVariants.map((v) => v.id)

  const allPrices = variantIds.length > 0
    ? await db
        .select()
        .from(astroVariantPrice)
        .where(inArray(astroVariantPrice.variant_id, variantIds))
    : []

  // Group prices by variant_id
  const pricesByVariant = new Map<string, typeof allPrices>()
  for (const price of allPrices) {
    const list = pricesByVariant.get(price.variant_id) || []
    list.push(price)
    pricesByVariant.set(price.variant_id, list)
  }

  // Group variants by product_id
  const variantsByProduct = new Map<string, Array<typeof allVariants[number] & { prices: typeof allPrices }>>()
  for (const variant of allVariants) {
    const list = variantsByProduct.get(variant.product_id) || []
    list.push({ ...variant, prices: pricesByVariant.get(variant.id) || [] })
    variantsByProduct.set(variant.product_id, list)
  }

  return products.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) || [],
  }))
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

export async function getProductByHandle(handle: string) {
  const products = await db
    .select()
    .from(astroProduct)
    .where(eq(astroProduct.handle, handle))
    .limit(1)

  const product = products[0]
  if (!product) throw new Error(`Produto ${handle} nao encontrado`)

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

export async function listPublishedProducts(limit = 100) {
  // Ordena por mais vendidos primeiro, depois por mais recentes
  const products = await db
    .select()
    .from(astroProduct)
    .where(eq(astroProduct.status, "published"))
    .orderBy(desc(sql`COALESCE(sales_count, 0)`), desc(astroProduct.created_at))
    .limit(limit)

  if (products.length === 0) return []

  const productIds = products.map((p) => p.id)
  const allVariants = await db
    .select()
    .from(astroProductVariant)
    .where(inArray(astroProductVariant.product_id, productIds))

  const variantIds = allVariants.map((v) => v.id)
  const allPrices = variantIds.length > 0
    ? await db.select().from(astroVariantPrice).where(inArray(astroVariantPrice.variant_id, variantIds))
    : []

  const pricesByVariant = new Map<string, typeof allPrices>()
  for (const price of allPrices) {
    const list = pricesByVariant.get(price.variant_id) || []
    list.push(price)
    pricesByVariant.set(price.variant_id, list)
  }

  const variantsByProduct = new Map<string, Array<typeof allVariants[number] & { prices: typeof allPrices }>>()
  for (const variant of allVariants) {
    const list = variantsByProduct.get(variant.product_id) || []
    list.push({ ...variant, prices: pricesByVariant.get(variant.id) || [] })
    variantsByProduct.set(variant.product_id, list)
  }

  return products.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) || [],
  }))
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

// ========== RELATED PRODUCTS (purchase history) ==========

export async function getRelatedByHistory(productId: string, limit = 4) {
  try {
    // Find products frequently bought together with this product
    const result = await db.execute(sql`
      WITH co_purchased AS (
        SELECT item->>'product_id' AS pid, COUNT(*) AS freq
        FROM astro_order,
          LATERAL jsonb_array_elements(items) AS item
        WHERE status != 'cancelled'
          AND items @> ${JSON.stringify([{ product_id: productId }])}::jsonb
          AND item->>'product_id' IS NOT NULL
          AND item->>'product_id' != ${productId}
        GROUP BY pid
        ORDER BY freq DESC
        LIMIT 12
      )
      SELECT p.* FROM astro_product p
      JOIN co_purchased cp ON p.id = cp.pid
      WHERE p.status = 'published'
      ORDER BY cp.freq DESC
      LIMIT ${limit}
    `)
    return result.rows as any[]
  } catch {
    return []
  }
}

// ========== REGIONS ==========

export async function listRegions() {
  return db
    .select()
    .from(astroRegion)
    .orderBy(astroRegion.name)
}
