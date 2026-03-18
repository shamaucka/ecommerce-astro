import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core"

export const astroCustomer = pgTable("astro_customer", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  cpf: text("cpf"),
  address_cep: text("address_cep"),
  address_street: text("address_street"),
  address_number: text("address_number"),
  address_complement: text("address_complement"),
  address_neighborhood: text("address_neighborhood"),
  address_city: text("address_city"),
  address_state: text("address_state"),
  order_count: integer("order_count").default(0),
  total_spent: integer("total_spent").default(0),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})
