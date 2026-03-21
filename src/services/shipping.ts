import { eq, desc } from "drizzle-orm"
import { db } from "../db/index.js"
import { shippingConfig, shippingZone } from "../db/schema/shipping.js"
// iMile: usado para criar pedido/rastrear (sem API de cotacao)

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
    extra_days: 0,
    extra_cost: 0,
    sender_zipcode: null,
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
  extra_days?: number
  extra_cost?: number
  sender_zipcode?: string
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
  const extraDays = config.extra_days || 0
  const extraCost = config.extra_cost || 0 // in cents

  // 1) Check free shipping threshold (amounts in cents)
  if (config.free_shipping_min && config.free_shipping_min > 0 && cartTotal >= config.free_shipping_min) {
    return {
      free: true,
      cost: 0,
      delivery_days_min: null,
      delivery_days_max: null,
      zone: null,
      source: "free_shipping",
      message: "Frete gratis",
    }
  }

  // 2) Flat rate override
  if (config.flat_rate_enabled && config.flat_rate_amount) {
    const cost = config.flat_rate_amount + extraCost
    return {
      free: false,
      cost,
      delivery_days_min: null,
      delivery_days_max: null,
      zone: null,
      source: "flat_rate",
      message: "Frete fixo",
    }
  }

  // 3) Try zone-based pricing (if zones are configured for this CEP's UF)
  const uf = cepToUF(cep)
  if (uf) {
    const zones = await listZones()
    const activeZones = zones.filter((z) => z.active)
    const zone = activeZones.find((z) => {
      const states = z.states as string[]
      return states.includes(uf)
    })

    if (zone) {
      const cost = zone.rate + extraCost
      const dMin = zone.delivery_days_min + extraDays
      const dMax = zone.delivery_days_max + extraDays
      return {
        free: false,
        cost,
        delivery_days_min: dMin,
        delivery_days_max: dMax,
        zone: zone.name,
        source: "zone",
        message: `${dMin}-${dMax} dias uteis`,
      }
    }
  }

  // 4) Fallback: tabela interna por distancia (quando nao tem zona configurada)
  //    iMile nao tem API de cotacao, so criacao de pedido/rastreio
  if (!uf) throw new Error("CEP invalido ou nao atendido")

  // Tabela padrao por regiao (pode ser sobrescrita por zonas manuais)
  const senderUf = cepToUF(config.sender_zipcode || process.env.STORE_ZIPCODE || "") || "SP"
  const REGION_MAP: Record<string, { region: string; baseCost: number; baseDays: number }> = {
    SP: { region: "Sudeste", baseCost: 1490, baseDays: 5 },
    RJ: { region: "Sudeste", baseCost: 1690, baseDays: 6 },
    MG: { region: "Sudeste", baseCost: 1690, baseDays: 6 },
    ES: { region: "Sudeste", baseCost: 1890, baseDays: 7 },
    PR: { region: "Sul", baseCost: 1890, baseDays: 7 },
    SC: { region: "Sul", baseCost: 1990, baseDays: 8 },
    RS: { region: "Sul", baseCost: 2190, baseDays: 9 },
    DF: { region: "Centro-Oeste", baseCost: 2190, baseDays: 8 },
    GO: { region: "Centro-Oeste", baseCost: 2190, baseDays: 8 },
    MS: { region: "Centro-Oeste", baseCost: 2390, baseDays: 9 },
    MT: { region: "Centro-Oeste", baseCost: 2590, baseDays: 10 },
    BA: { region: "Nordeste", baseCost: 2590, baseDays: 10 },
    PE: { region: "Nordeste", baseCost: 2790, baseDays: 11 },
    CE: { region: "Nordeste", baseCost: 2790, baseDays: 11 },
    SE: { region: "Nordeste", baseCost: 2590, baseDays: 10 },
    AL: { region: "Nordeste", baseCost: 2790, baseDays: 11 },
    PB: { region: "Nordeste", baseCost: 2790, baseDays: 11 },
    RN: { region: "Nordeste", baseCost: 2790, baseDays: 11 },
    PI: { region: "Nordeste", baseCost: 2990, baseDays: 12 },
    MA: { region: "Nordeste", baseCost: 2990, baseDays: 12 },
    PA: { region: "Norte", baseCost: 3290, baseDays: 14 },
    AM: { region: "Norte", baseCost: 3990, baseDays: 16 },
    AP: { region: "Norte", baseCost: 3590, baseDays: 15 },
    TO: { region: "Norte", baseCost: 2990, baseDays: 12 },
    RO: { region: "Norte", baseCost: 3290, baseDays: 14 },
    RR: { region: "Norte", baseCost: 3990, baseDays: 16 },
    AC: { region: "Norte", baseCost: 3990, baseDays: 16 },
  }

  const dest = REGION_MAP[uf]
  if (!dest) throw new Error(`Regiao nao atendida para ${uf}`)

  // If sending from same state, reduce cost/time
  const sameState = uf === senderUf
  const sameRegion = dest.region === (REGION_MAP[senderUf]?.region || "Sudeste")
  const costReduction = sameState ? 500 : sameRegion ? 200 : 0
  const daysReduction = sameState ? 2 : sameRegion ? 1 : 0

  const finalCost = Math.max(dest.baseCost - costReduction, 990) + extraCost
  const finalDaysMin = Math.max(dest.baseDays - daysReduction, 2) + extraDays
  const finalDaysMax = finalDaysMin + 3

  return {
    free: false,
    cost: finalCost,
    delivery_days_min: finalDaysMin,
    delivery_days_max: finalDaysMax,
    zone: null,
    source: "auto",
    message: `${finalDaysMin}-${finalDaysMax} dias uteis`,
  }
}
