import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core"

export const astroCategory = pgTable("astro_category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  seo_title: text("seo_title"),
  seo_description: text("seo_description"),
  image: text("image"),
  parent_id: text("parent_id"),
  position: integer("position").default(0),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})
