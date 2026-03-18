import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core"

export const productReview = pgTable("product_review", {
  id: text("id").primaryKey(),
  product_id: text("product_id").notNull(),
  customer_name: text("customer_name").notNull(),
  customer_email: text("customer_email").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  comment: text("comment"),
  verified_purchase: boolean("verified_purchase").default(false),
  approved: boolean("approved").default(false),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})
