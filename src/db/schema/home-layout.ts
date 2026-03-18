import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core"

export const homeLayoutConfig = pgTable("home_layout_config", {
  id: text("id").primaryKey(),
  sections: jsonb("sections").notNull().default([]),
  updated_at: timestamp("updated_at").defaultNow(),
  updated_by: text("updated_by"),
})
