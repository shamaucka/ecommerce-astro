import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { homeLayoutConfig } from "../db/schema/home-layout.js"

// ========== HOME LAYOUT ==========

const DEFAULT_LAYOUT = [
  { type: "hero", enabled: true, position: 0 },
  { type: "featured_products", enabled: true, position: 1 },
  { type: "categories", enabled: true, position: 2 },
  { type: "promotions", enabled: true, position: 3 },
]

export async function getLayout() {
  const results = await db
    .select()
    .from(homeLayoutConfig)
    .limit(1)

  if (!results[0]) {
    return {
      id: null,
      sections: DEFAULT_LAYOUT,
      updated_at: null,
      updated_by: null,
    }
  }

  return results[0]
}

export async function saveLayout(sections: any[], updatedBy?: string) {
  const existing = await db
    .select()
    .from(homeLayoutConfig)
    .limit(1)

  if (existing[0]) {
    const result = await db
      .update(homeLayoutConfig)
      .set({
        sections,
        updated_at: new Date(),
        updated_by: updatedBy,
      })
      .where(eq(homeLayoutConfig.id, existing[0].id))
      .returning()
    return result[0]
  }

  const result = await db
    .insert(homeLayoutConfig)
    .values({
      id: crypto.randomUUID(),
      sections,
      updated_at: new Date(),
      updated_by: updatedBy,
    })
    .returning()

  return result[0]
}
