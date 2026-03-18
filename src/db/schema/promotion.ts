import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core"

export const promotion = pgTable("promotion", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("coupon"),
  code: text("code").unique(),
  discount_type: text("discount_type").notNull().default("percentage"),
  discount_value: integer("discount_value").notNull().default(0),
  min_purchase: integer("min_purchase").default(0),
  category_id: text("category_id"),
  min_items: integer("min_items").default(0),
  max_uses: integer("max_uses"),
  used_count: integer("used_count").default(0),
  active: boolean("active").default(true),
  valid_from: timestamp("valid_from"),
  valid_until: timestamp("valid_until"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})
