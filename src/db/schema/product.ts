import { pgTable, text, timestamp, integer, real, boolean, jsonb, unique } from "drizzle-orm/pg-core"

export const astroProduct = pgTable("astro_product", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  handle: text("handle").notNull().unique(),
  subtitle: text("subtitle"),
  description: text("description"),
  status: text("status").default("draft"),
  weight: real("weight"),
  length: real("length"),
  width: real("width"),
  height: real("height"),
  material: text("material"),
  origin_country: text("origin_country").default("BR"),
  mid_code: text("mid_code"),
  hs_code: text("hs_code"),
  category_id: text("category_id"),
  thumbnail: text("thumbnail"),
  images: jsonb("images").default([]),
  metadata: jsonb("metadata"),
  sales_count: integer("sales_count").default(0),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})

export const astroProductVariant = pgTable("astro_product_variant", {
  id: text("id").primaryKey(),
  product_id: text("product_id").notNull().references(() => astroProduct.id),
  title: text("title").default("Padrao"),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  ean: text("ean"),
  manage_inventory: boolean("manage_inventory").default(true),
  options: jsonb("options").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})

export const astroVariantPrice = pgTable("astro_variant_price", {
  id: text("id").primaryKey(),
  variant_id: text("variant_id").notNull().references(() => astroProductVariant.id),
  amount: integer("amount").notNull(),
  currency_code: text("currency_code").notNull().default("brl"),
  created_at: timestamp("created_at").defaultNow(),
})

export const astroRegion = pgTable("astro_region", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency_code: text("currency_code").notNull(),
  countries: jsonb("countries").default([]),
  created_at: timestamp("created_at").defaultNow(),
})

export const astroAdminUser = pgTable("astro_admin_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  created_at: timestamp("created_at").defaultNow(),
})
