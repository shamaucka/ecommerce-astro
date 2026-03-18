import { eq, asc, and, isNull } from "drizzle-orm"
import { db } from "../db/index.js"
import { astroCategory } from "../db/schema/category.js"

// ========== CATEGORIES ==========

export async function listCategories() {
  return db
    .select()
    .from(astroCategory)
    .where(eq(astroCategory.active, true))
    .orderBy(asc(astroCategory.position))
}

export async function getCategoryTree() {
  const all = await db
    .select()
    .from(astroCategory)
    .where(eq(astroCategory.active, true))
    .orderBy(asc(astroCategory.position))

  const roots = all.filter((c) => !c.parent_id)
  return roots.map((parent) => ({
    ...parent,
    children: all.filter((c) => c.parent_id === parent.id),
  }))
}

export async function getCategoryBySlug(slug: string) {
  const results = await db
    .select()
    .from(astroCategory)
    .where(eq(astroCategory.slug, slug))
    .limit(1)

  if (!results[0]) throw new Error(`Categoria "${slug}" nao encontrada`)
  return results[0]
}

export async function createCategory(data: {
  name: string
  slug: string
  description?: string
  seo_title?: string
  seo_description?: string
  image?: string
  parent_id?: string
  position?: number
  active?: boolean
}) {
  const result = await db
    .insert(astroCategory)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

export async function updateCategory(id: string, data: Record<string, any>) {
  const result = await db
    .update(astroCategory)
    .set({ ...data, updated_at: new Date() })
    .where(eq(astroCategory.id, id))
    .returning()

  if (!result[0]) throw new Error(`Categoria ${id} nao encontrada`)
  return result[0]
}

export async function deleteCategory(id: string) {
  await db
    .delete(astroCategory)
    .where(eq(astroCategory.id, id))

  return { deleted: true }
}
