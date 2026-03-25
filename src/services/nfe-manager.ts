import { eq, desc, and, sql, count } from "drizzle-orm"
import { db } from "../db/index.js"
import { nfeRegistro, storeFiscalConfig } from "../db/schema/fiscal-br.js"
import { astroOrder } from "../db/schema/order.js"
import * as nfeEmitter from "./nfe-emitter.js"

// ========== LIST ==========

export async function listNotas(filters: { tipo?: string; status?: string; page?: number; limit?: number; search?: string }) {
  const { tipo, status, page = 1, limit = 50, search } = filters
  let query = db.select().from(nfeRegistro)

  const conditions = []
  if (tipo) conditions.push(eq(nfeRegistro.tipo, tipo))
  if (status) conditions.push(eq(nfeRegistro.status, status))

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any
  }

  const notas = await (query as any)
    .orderBy(desc(nfeRegistro.created_at))
    .limit(limit)
    .offset((page - 1) * limit)

  return notas
}

// ========== STATS ==========

export async function getStats() {
  const rows = await db
    .select({ status: nfeRegistro.status, count: count() })
    .from(nfeRegistro)
    .groupBy(nfeRegistro.status)

  const stats: Record<string, number> = { total: 0, pendente: 0, autorizada: 0, rejeitada: 0, cancelada: 0 }
  for (const row of rows) {
    stats[row.status || "pendente"] = Number(row.count)
    stats.total += Number(row.count)
  }
  return stats
}

// ========== EMIT SAIDA ==========

export async function emitirSaida(orderId: string) {
  // Busca pedido
  const orders = await db.select().from(astroOrder).where(eq(astroOrder.id, orderId)).limit(1)
  const order = orders[0]
  if (!order) throw new Error("Pedido nao encontrado")

  // Busca config fiscal
  const configs = await db.select().from(storeFiscalConfig).limit(1)
  const config = configs[0]
  if (!config) throw new Error("Configuracao fiscal nao encontrada")

  const nextNumber = (await db.select({ max: sql<number>`COALESCE(MAX(numero), 0)` }).from(nfeRegistro).where(eq(nfeRegistro.serie, 3)))[0]?.max + 1 || 1

  const items = (order.items as any[]) || []

  // Monta dados para emissao
  const nfeData = {
    numero: nextNumber,
    serie: 3,
    cliente: {
      nome: order.customer_name || "Consumidor",
      cpf: (order as any).customer_cpf || undefined,
      email: order.customer_email || undefined,
      endereco: {
        logradouro: order.shipping_address_line1 || "",
        numero: "S/N",
        complemento: order.shipping_address_line2 || "",
        bairro: order.shipping_neighborhood || "",
        cidade: order.shipping_city || "",
        uf: order.shipping_state || "",
        cep: order.shipping_postal_code || "",
        codigo_municipio: "",
      },
    },
    itens: items.map((item: any) => ({
      codigo: item.sku || item.product_id || "QUADRO",
      descricao: item.title || "Quadro Decorativo",
      ncm: config.ncm_padrao || "9701.91.00",
      cfop: order.shipping_state === config.uf
        ? (config.cfop_dentro_estado || "5102")
        : (config.cfop_fora_estado || "6102"),
      unidade: config.unidade_comercial || "UN",
      quantidade: item.quantity || 1,
      valor_unitario: (item.unit_price || 9700) / 100,
      valor_total: ((item.unit_price || 9700) * (item.quantity || 1)) / 100,
    })),
    frete: { modalidade: 0, valor: (order.shipping_cost || 0) / 100 },
    pagamento: {
      forma: order.payment_method === "pix" ? "17" : order.payment_method === "credit_card" ? "03" : "01",
      valor: (order.total || 0) / 100,
    },
  }

  // Registra como pendente
  const registro = await db.insert(nfeRegistro).values({
    id: `nfe_${Date.now()}`,
    tipo: "saida",
    numero: nextNumber,
    serie: 3,
    status: "pendente",
    order_id: orderId,
    customer_name: order.customer_name || "",
    customer_cpf: (order as any).customer_cpf || "",
    valor_total: order.total || 0,
    cfop: nfeData.itens[0]?.cfop || "5102",
    natureza_operacao: config.natureza_operacao || "Venda de mercadoria",
  }).returning()

  // Tenta emitir
  try {
    const resultado = await nfeEmitter.emitirNFe(nfeData)

    await db.update(nfeRegistro).set({
      status: resultado.success ? "autorizada" : "rejeitada",
      chave_acesso: resultado.chave || null,
      protocolo: resultado.protocolo || null,
      xml: resultado.xml || null,
      motivo_rejeicao: resultado.success ? null : (resultado.motivo || resultado.error || "Erro desconhecido"),
      updated_at: new Date(),
    }).where(eq(nfeRegistro.id, registro[0].id))

    return { ...registro[0], ...resultado }
  } catch (err: any) {
    await db.update(nfeRegistro).set({
      status: "rejeitada",
      motivo_rejeicao: err.message || "Erro ao comunicar com SEFAZ",
      updated_at: new Date(),
    }).where(eq(nfeRegistro.id, registro[0].id))

    return { ...registro[0], success: false, error: err.message }
  }
}

// ========== EMIT ENTRADA ==========

export async function emitirEntrada(data: { nfe_referenciada: string; motivo: string; itens: any[]; valor_total: number }) {
  const configs = await db.select().from(storeFiscalConfig).limit(1)
  const config = configs[0]
  if (!config) throw new Error("Configuracao fiscal nao encontrada")

  const nextNumber = (await db.select({ max: sql<number>`COALESCE(MAX(numero), 0)` }).from(nfeRegistro).where(eq(nfeRegistro.serie, 4)))[0]?.max + 1 || 1

  const registro = await db.insert(nfeRegistro).values({
    id: `nfe_ent_${Date.now()}`,
    tipo: "entrada",
    numero: nextNumber,
    serie: 4,
    status: "pendente",
    valor_total: data.valor_total,
    cfop: "1202",
    natureza_operacao: "Devolucao de mercadoria",
    nfe_referenciada: data.nfe_referenciada,
    metadata: { motivo: data.motivo },
  }).returning()

  return registro[0]
}

// ========== CANCEL ==========

export async function cancelar(id: string, justificativa: string) {
  if (justificativa.length < 15) throw new Error("Justificativa deve ter pelo menos 15 caracteres")

  const notas = await db.select().from(nfeRegistro).where(eq(nfeRegistro.id, id)).limit(1)
  const nota = notas[0]
  if (!nota) throw new Error("Nota nao encontrada")
  if (nota.status !== "autorizada") throw new Error("Somente notas autorizadas podem ser canceladas")
  if (!nota.chave_acesso || !nota.protocolo) throw new Error("Nota sem chave de acesso ou protocolo")

  try {
    const resultado = await nfeEmitter.cancelarNFe(nota.chave_acesso, nota.protocolo, justificativa)
    await db.update(nfeRegistro).set({
      status: "cancelada",
      motivo_cancelamento: justificativa,
      updated_at: new Date(),
    }).where(eq(nfeRegistro.id, id))

    return { success: true, resultado }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ========== CONSULT ==========

export async function consultar(id: string) {
  const notas = await db.select().from(nfeRegistro).where(eq(nfeRegistro.id, id)).limit(1)
  const nota = notas[0]
  if (!nota || !nota.chave_acesso) throw new Error("Nota sem chave de acesso")

  const resultado = await nfeEmitter.consultarNFe(nota.chave_acesso)
  return resultado
}

// ========== DANFE ==========

export async function gerarDanfe(id: string) {
  const notas = await db.select().from(nfeRegistro).where(eq(nfeRegistro.id, id)).limit(1)
  const nota = notas[0]
  if (!nota || !nota.xml) throw new Error("Nota sem XML")

  if (nota.danfe_base64) return nota.danfe_base64

  const pdf = await nfeEmitter.gerarDanfe(nota.xml)

  await db.update(nfeRegistro).set({ danfe_base64: pdf, updated_at: new Date() }).where(eq(nfeRegistro.id, id))

  return pdf
}

// ========== RETRY ==========

export async function retentar(id: string) {
  const notas = await db.select().from(nfeRegistro).where(eq(nfeRegistro.id, id)).limit(1)
  const nota = notas[0]
  if (!nota) throw new Error("Nota nao encontrada")
  if (nota.status !== "rejeitada") throw new Error("Somente notas rejeitadas podem ser retentadas")
  if (!nota.order_id) throw new Error("Nota sem pedido associado")

  return emitirSaida(nota.order_id)
}
