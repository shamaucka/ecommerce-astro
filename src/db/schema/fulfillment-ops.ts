import { pgTable, text, timestamp, integer, boolean, real, jsonb } from "drizzle-orm/pg-core"

export const fulfillmentTask = pgTable("fulfillment_task", {
  id: text("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  deleted_at: timestamp("deleted_at"),

  order_id: text("order_id"),
  display_id: text("display_id"),
  customer_name: text("customer_name"),
  customer_email: text("customer_email"),
  status: text("status").default("aguardando_separacao"),
  items_total: integer("items_total").default(0),
  picking_list_printed: boolean("picking_list_printed").default(false),
  printed_at: timestamp("printed_at"),
  items_checked: integer("items_checked").default(0),
  checked_at: timestamp("checked_at"),
  checker_name: text("checker_name"),
  invoice_number: text("invoice_number"),
  invoice_key: text("invoice_key"),
  invoiced_at: timestamp("invoiced_at"),
  danfe_printed: boolean("danfe_printed").default(false),
  carrier: text("carrier"),
  tracking_code: text("tracking_code"),
  shipping_label_printed: boolean("shipping_label_printed").default(false),
  romaneio_id: text("romaneio_id"),
  shipped_at: timestamp("shipped_at"),
  order_total: real("order_total"),
  metadata: jsonb("metadata"),
})

export const fulfillmentTaskItem = pgTable("fulfillment_task_item", {
  id: text("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  deleted_at: timestamp("deleted_at"),

  task_id: text("task_id"),
  product_id: text("product_id"),
  variant_id: text("variant_id"),
  sku: text("sku"),
  barcode: text("barcode"),
  product_title: text("product_title"),
  variant_title: text("variant_title"),
  quantity: integer("quantity").default(1),
  checked: boolean("checked").default(false),
  location: text("location"),
  weight_grams: real("weight_grams"),
})

export const romaneio = pgTable("romaneio", {
  id: text("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  deleted_at: timestamp("deleted_at"),

  carrier: text("carrier"),
  status: text("status").default("aberto"),
  packages_count: integer("packages_count").default(0),
  closed_at: timestamp("closed_at"),
  closed_by: text("closed_by"),
  metadata: jsonb("metadata"),
})
