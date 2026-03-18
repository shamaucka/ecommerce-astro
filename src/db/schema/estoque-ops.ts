import { pgTable, text, timestamp, integer, boolean, real, jsonb } from "drizzle-orm/pg-core"

export const stockLocation = pgTable("wh_location", {
  id: text("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  deleted_at: timestamp("deleted_at"),

  code: text("code"),
  name: text("name"),
  zone: text("zone"),
  capacity: integer("capacity"),
  active: boolean("active").default(true),
  metadata: jsonb("metadata"),
})

export const stockPosition = pgTable("wh_position", {
  id: text("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  deleted_at: timestamp("deleted_at"),

  product_id: text("product_id"),
  variant_id: text("variant_id"),
  sku: text("sku"),
  product_title: text("product_title"),
  variant_title: text("variant_title"),
  location_code: text("location_code"),
  quantity: integer("quantity").default(0),
  min_quantity: integer("min_quantity").default(0),
  max_quantity: integer("max_quantity"),
  cost_price: real("cost_price"),
  metadata: jsonb("metadata"),
})

export const stockMovement = pgTable("wh_movement", {
  id: text("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  deleted_at: timestamp("deleted_at"),

  position_id: text("position_id"),
  product_id: text("product_id"),
  variant_id: text("variant_id"),
  sku: text("sku"),
  type: text("type"),
  quantity: integer("quantity"),
  quantity_before: integer("quantity_before"),
  quantity_after: integer("quantity_after"),
  reason: text("reason"),
  reference_type: text("reference_type"),
  reference_id: text("reference_id"),
  location_code: text("location_code"),
  cost_price: real("cost_price"),
  user_name: text("user_name"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
})
