import { db } from "../db/index.js"
import { sql } from "drizzle-orm"

const TABLE = "test_card_vault"

export async function listCards() {
  const result = await db.execute(sql`SELECT * FROM test_card_vault ORDER BY created_at DESC`)
  return result.rows as any[]
}

export async function saveCard(data: {
  label: string
  card_number: string
  card_expiry: string
  card_cvv: string
  card_name: string
  customer_email: string
  customer_cpf: string
  customer_name: string
  customer_phone?: string
  address_line1?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  address_postal_code?: string
}) {
  const id = crypto.randomUUID()
  await db.execute(sql`
    INSERT INTO test_card_vault (
      id, label, card_number, card_expiry, card_cvv, card_name,
      customer_email, customer_cpf, customer_name, customer_phone,
      address_line1, address_neighborhood, address_city, address_state, address_postal_code
    ) VALUES (
      ${id}, ${data.label}, ${data.card_number}, ${data.card_expiry}, ${data.card_cvv}, ${data.card_name},
      ${data.customer_email}, ${data.customer_cpf}, ${data.customer_name}, ${data.customer_phone || ""},
      ${data.address_line1 || ""}, ${data.address_neighborhood || ""}, ${data.address_city || ""},
      ${data.address_state || ""}, ${data.address_postal_code || ""}
    )
  `)
  return { id }
}

export async function deleteCard(id: string) {
  await db.execute(sql`DELETE FROM test_card_vault WHERE id = ${id}`)
  return { deleted: true }
}
