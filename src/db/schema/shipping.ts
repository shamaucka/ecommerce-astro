import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core"

export const shippingConfig = pgTable("shipping_config", {
  id: text("id").primaryKey(),
  free_shipping_min: integer("free_shipping_min").default(0),
  flat_rate_enabled: boolean("flat_rate_enabled").default(false),
  flat_rate_amount: integer("flat_rate_amount").default(0),
  carrier: text("carrier").default("imile"),
  imile_product_code: text("imile_product_code"),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})

export const shippingZone = pgTable("shipping_zone", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  states: jsonb("states").notNull().default([]),
  rate: integer("rate").notNull().default(0),
  delivery_days_min: integer("delivery_days_min").notNull().default(1),
  delivery_days_max: integer("delivery_days_max").notNull().default(5),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})
