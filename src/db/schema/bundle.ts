import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core"

export const productBundle = pgTable("product_bundle", {
  id: text("id").primaryKey(),
  product_id: text("product_id").notNull(),
  related_product_id: text("related_product_id").notNull(),
  discount_percent: integer("discount_percent").default(5),
  position: integer("position").default(0),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})
