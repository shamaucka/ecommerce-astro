import { eq, desc } from "drizzle-orm"
import { db } from "../db/index.js"
import { shippingConfig, shippingZone } from "../db/schema/shipping.js"

// ========== CEP -> UF MAPPING ==========

const CEP_UF_RANGES: Array<{ min: number; max: number; uf: string }> = [
  { min: 1000000, max: 19999999, uf: "SP" },
  { min: 20000000, max: 28999999, uf: "RJ" },
  { min: 29000000, max: 29999999, uf: "ES" },
  { min: 30000000, max: 39999999, uf: "MG" },
  { min: 40000000, max: 48999999, uf: "BA" },
  { min: 49000000, max: 49999999, uf: "SE" },
  { min: 50000000, max: 56999999, uf: "PE" },
  { min: 57000000, max: 57999999, uf: "AL" },
  { min: 58000000, max: 58999999, uf: "PB" },
  { min: 59000000, max: 59999999, uf: "RN" },
  { min: 60000000, max: 63999999, uf: "CE" },
  { min: 64000000, max: 64999999, uf: "PI" },
  { min: 65000000, max: 65999999, uf: "MA" },
  { min: 66000000, max: 68899999, uf: "PA" },
  { min: 68900000, max: 68999999, uf: "AP" },
  { min: 69000000, max: 69299999, uf: "AM" },
  { min: 69300000, max: 69399999, uf: "RR" },
  { min: 69400000, max: 69899999, uf: "AM" },
  { min: 69900000, max: 69999999, uf: "AC" },
  { min: 70000000, max: 72799999, uf: "DF" },
  { min: 72800000, max: 72999999, uf: "GO" },
  { min: 73000000, max: 73699999, uf: "GO" },
  { min: 73700000, max: 76799999, uf: "GO" },
  { min: 76800000, max: 76999999, uf: "TO" },
  { min: 77000000, max: 77999999, uf: "TO" },
  { min: 78000000, max: 78899999, uf: "MT" },
  { min: 78900000, max: 78999999, uf: "MS" },
  { min: 79000000, max: 79999999, uf: "MS" },
  { min: 80000000, max: 87999999, uf: "PR" },
  { min: 88000000, max: 89999999, uf: "SC" },
  { min: 90000000, max: 99999999, uf: "RS" },
]

function cepToUF(cep: string): string | null {
  const num = parseInt(cep.replace(/\D/g, ""), 10)
  if (isNaN(num)) return null
  for (const range of CEP_UF_RANGES) {
    if (num >= range.min && num <= range.max) return range.uf
  }
  return null
}

// ========== CONFIG ==========

export async function getShippingConfig() {
  const rows = await db.select().from(shippingConfig).limit(1)
  if (rows[0]) return rows[0]
  // Return defaults if no config exists
  return {
    id: null,
    free_shipping_min: 0,
    flat_rate_enabled: false,
    flat_rate_amount: 0,
    carrier: "imile",
    imile_product_code: null,
    active: true,
    created_at: null,
    updated_at: null,
  }
}

export async function saveShippingConfig(data: {
  free_shipping_min?: number
  flat_rate_enabled?: boolean
  flat_rate_amount?: number
  carrier?: string
  imile_product_code?: string
  active?: boolean
}) {
  const existing = await db.select().from(shippingConfig).limit(1)

  if (existing[0]) {
    const result = await db
      .update(shippingConfig)
      .set({ ...data, updated_at: new Date() })
      .where(eq(shippingConfig.id, existing[0].id))
      .returning()
    return result[0]
  }

  const result = await db
    .insert(shippingConfig)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

// ========== ZONES ==========

export async function listZones() {
  return db
    .select()
    .from(shippingZone)
    .orderBy(desc(shippingZone.created_at))
}

export async function createZone(data: {
  name: string
  states: string[]
  rate: number
  delivery_days_min: number
  delivery_days_max: number
  active?: boolean
}) {
  const result = await db
    .insert(shippingZone)
    .values({
      id: crypto.randomUUID(),
      ...data,
      active: data.active ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()

  return result[0]
}

export async function updateZone(id: string, data: {
  name?: string
  states?: string[]
  rate?: number
  delivery_days_min?: number
  delivery_days_max?: number
  active?: boolean
}) {
  const result = await db
    .update(shippingZone)
    .set({ ...data, updated_at: new Date() })
    .where(eq(shippingZone.id, id))
    .returning()

  if (!result[0]) throw new Error(`Zona de frete ${id} nao encontrada`)
  return result[0]
}

export async function deleteZone(id: string) {
  await db
    .delete(shippingZone)
    .where(eq(shippingZone.id, id))

  return { deleted: true }
}

// ========== CALCULATE SHIPPING ==========

export async function calculateShipping(cep: string, cartTotal: number, _cartItems?: any[]) {
  const config = await getShippingConfig()

  // Check free shipping threshold (amounts in cents)
  if (config.free_shipping_min && config.free_shipping_min > 0 && cartTotal >= config.free_shipping_min) {
    return {
      free: true,
      cost: 0,
      delivery_days_min: null,
      delivery_days_max: null,
      zone: null,
      message: "Frete gratis",
    }
  }

  // Flat rate
  if (config.flat_rate_enabled && config.flat_rate_amount) {
    return {
      free: false,
      cost: config.flat_rate_amount,
      delivery_days_min: null,
      delivery_days_max: null,
      zone: null,
      message: "Frete fixo",
    }
  }

  // Zone-based
  const uf = cepToUF(cep)
  if (!uf) {
    throw new Error("CEP invalido ou nao atendido")
  }

  const zones = await listZones()
  const activeZones = zones.filter((z) => z.active)

  const zone = activeZones.find((z) => {
    const states = z.states as string[]
    return states.includes(uf)
  })

  if (!zone) {
    throw new Error(`Regiao nao atendida para o estado ${uf}`)
  }

  return {
    free: false,
    cost: zone.rate,
    delivery_days_min: zone.delivery_days_min,
    delivery_days_max: zone.delivery_days_max,
    zone: zone.name,
    message: `${zone.delivery_days_min}-${zone.delivery_days_max} dias uteis`,
  }
}
