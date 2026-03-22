import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core"

export const astroCustomer = pgTable("astro_customer", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  cpf: text("cpf"),
  address_line1: text("address_line1"),
  address_line2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postal_code: text("postal_code"),
  country: text("country").default("BR"),
  neighborhood: text("neighborhood"),
  order_count: integer("order_count").default(0),
  total_spent: integer("total_spent").default(0),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})
