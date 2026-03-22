import { eq, and, isNull, asc, desc, inArray } from "drizzle-orm"
import { db } from "../db/index.js"
import { fulfillmentTask, fulfillmentTaskItem, romaneio } from "../db/schema/fulfillment-ops.js"

function buildWhere(table: typeof fulfillmentTask, filters: Record<string, any>) {
  const conditions = []
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && key in table) {
      const col = (table as any)[key]
      if (Array.isArray(value)) {
        conditions.push(inArray(col, value))
      } else {
        conditions.push(eq(col, value))
      }
    }
  }
  return conditions
}

function buildItemWhere(table: typeof fulfillmentTaskItem, filters: Record<string, any>) {
  const conditions = []
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && key in table) {
      const col = (table as any)[key]
      if (Array.isArray(value)) {
        conditions.push(inArray(col, value))
      } else {
        conditions.push(eq(col, value))
      }
    }
  }
  return conditions
}

// ========== TASK CRUD ==========

async function listTasks(filters: Record<string, any> = {}, options?: { order?: any; take?: number }) {
  const where = buildWhere(fulfillmentTask, filters)
  let query = db
    .select()
    .from(fulfillmentTask)
    .where(and(...where, isNull(fulfillmentTask.deleted_at)))

  if (options?.order) {
    const [field, dir] = Object.entries(options.order)[0]
    const col = (fulfillmentTask as any)[field]
    if (col) {
      query = query.orderBy(dir === "DESC" ? desc(col) : asc(col)) as any
    }
  }

  if (options?.take) {
    query = query.limit(options.take) as any
  }

  return query
}

async function retrieveTask(id: string) {
  const results = await db
    .select()
    .from(fulfillmentTask)
    .where(and(eq(fulfillmentTask.id, id), isNull(fulfillmentTask.deleted_at)))
    .limit(1)
  if (!results[0]) throw new Error(`FulfillmentTask ${id} nao encontrado`)
  return results[0]
}

async function createTask(data: Record<string, any>) {
  const result = await db
    .insert(fulfillmentTask)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()
  return result[0]
}

async function updateTask(id: string, data: Record<string, any>) {
  const result = await db
    .update(fulfillmentTask)
    .set({ ...data, updated_at: new Date() })
    .where(eq(fulfillmentTask.id, id))
    .returning()
  return result[0]
}

// ========== TASK ITEM CRUD ==========

async function listTaskItems(filters: Record<string, any> = {}, options?: { order?: any; take?: number }) {
  const where = buildItemWhere(fulfillmentTaskItem, filters)
  let query = db
    .select()
    .from(fulfillmentTaskItem)
    .where(and(...where, isNull(fulfillmentTaskItem.deleted_at)))

  if (options?.order) {
    const [field, dir] = Object.entries(options.order)[0]
    const col = (fulfillmentTaskItem as any)[field]
    if (col) {
      query = query.orderBy(dir === "DESC" ? desc(col) : asc(col)) as any
    }
  }

  if (options?.take) {
    query = query.limit(options.take) as any
  }

  return query
}

async function createTaskItem(data: Record<string, any>) {
  const result = await db
    .insert(fulfillmentTaskItem)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()
  return result[0]
}

// ========== ROMANEIO CRUD ==========

async function retrieveRomaneioById(id: string) {
  const results = await db
    .select()
    .from(romaneio)
    .where(and(eq(romaneio.id, id), isNull(romaneio.deleted_at)))
    .limit(1)
  if (!results[0]) throw new Error(`Romaneio ${id} nao encontrado`)
  return results[0]
}

async function createRomaneioRecord(data: Record<string, any>) {
  const result = await db
    .insert(romaneio)
    .values({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning()
  return result[0]
}

async function updateRomaneioRecord(id: string, data: Record<string, any>) {
  const result = await db
    .update(romaneio)
    .set({ ...data, updated_at: new Date() })
    .where(eq(romaneio.id, id))
    .returning()
  return result[0]
}

async function listRomaneios(filters: Record<string, any> = {}, options?: { order?: any }) {
  const conditions = []
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && key in romaneio) {
      conditions.push(eq((romaneio as any)[key], value))
    }
  }

  let query = db
    .select()
    .from(romaneio)
    .where(and(...conditions, isNull(romaneio.deleted_at)))

  if (options?.order) {
    const [field, dir] = Object.entries(options.order)[0]
    const col = (romaneio as any)[field]
    if (col) {
      query = query.orderBy(dir === "DESC" ? desc(col) : asc(col)) as any
    }
  }

  return query
}

// ========== SEPARACAO ==========

export async function getOrdersForSeparation() {
  return listTasks(
    { status: "aguardando_separacao" },
    { order: { created_at: "ASC" }, take: 100 }
  )
}

export async function printPickingList(taskIds: string[]) {
  const tasks = []
  for (const id of taskIds) {
    const task = await retrieveTask(id)
    const items = await listTaskItems(
      { task_id: id },
      { order: { location: "ASC" } }
    )
    await updateTask(id, {
      status: "em_separacao",
      picking_list_printed: true,
      printed_at: new Date(),
    })
    tasks.push({ ...task, status: "em_separacao", items })
  }
  return tasks
}

export async function createFromOrder(orderData: {
  order_id: string
  display_id?: string
  customer_name?: string
  customer_email?: string
  order_total?: number
  carrier?: string
  tracking_code?: string
  invoice_number?: string
  invoice_key?: string
  items: Array<{
    product_id?: string
    variant_id?: string
    sku: string
    barcode?: string
    product_title: string
    variant_title?: string
    quantity: number
    location?: string
    weight_grams?: number
  }>
}) {
  const existing = await listTasks({ order_id: orderData.order_id })
  if (existing.length > 0) return existing[0]

  const task = await createTask({
    order_id: orderData.order_id,
    display_id: orderData.display_id || orderData.order_id,
    customer_name: orderData.customer_name,
    customer_email: orderData.customer_email,
    order_total: orderData.order_total,
    carrier: orderData.carrier,
    tracking_code: orderData.tracking_code,
    invoice_number: orderData.invoice_number,
    invoice_key: orderData.invoice_key,
    status: "aguardando_separacao",
    items_total: orderData.items.reduce((sum, i) => sum + i.quantity, 0),
  })

  for (const item of orderData.items) {
    await createTaskItem({
      task_id: task.id,
      ...item,
    })
  }

  return task
}

// ========== CONFERENCIA ==========

export async function getTaskByOrderBarcode(barcode: string) {
  let tasks = await listTasks({ display_id: barcode })
  if (!tasks.length) {
    tasks = await listTasks({ order_id: barcode })
  }
  if (!tasks.length) throw new Error(`Pedido ${barcode} nao encontrado`)

  const task = tasks[0]
  const allowedStatuses = ["aguardando_separacao", "em_separacao", "aguardando_conferencia"]
  if (!allowedStatuses.includes(task.status!)) {
    throw new Error(`Pedido ${barcode} nao esta pronto para conferencia (status: ${task.status})`)
  }

  const items = await listTaskItems(
    { task_id: task.id },
    { order: { location: "ASC" } }
  )

  if (task.status !== "aguardando_conferencia") {
    await updateTask(task.id, { status: "aguardando_conferencia" })
  }

  return { ...task, status: "aguardando_conferencia", items }
}

export async function markConferencePrinted(taskId: string) {
  await updateTask(taskId, {
    danfe_printed: true,
    shipping_label_printed: true,
  })
  return retrieveTask(taskId)
}

export async function getCheckedTasks() {
  return listTasks(
    { status: "conferido" },
    { order: { checked_at: "ASC" }, take: 200 }
  )
}

// ========== DESPACHO / ROMANEIO ==========

export async function createRomaneio(carrier: string) {
  return createRomaneioRecord({
    carrier,
    status: "aberto",
    packages_count: 0,
  })
}

export async function addToRomaneio(romaneioId: string, invoiceBarcode: string) {
  let allTasks = await listTasks({ invoice_number: invoiceBarcode })
  if (!allTasks.length) {
    allTasks = await listTasks({ invoice_key: invoiceBarcode })
  }
  if (!allTasks.length) {
    allTasks = await listTasks({ display_id: invoiceBarcode })
  }
  if (!allTasks.length) throw new Error(`Pedido com NF ${invoiceBarcode} nao encontrado no sistema`)

  const task = allTasks[0]

  if (task.status === "cancelado") {
    throw new Error(`PEDIDO #${task.display_id} ESTA CANCELADO! Nao pode ser despachado.`)
  }

  if (task.status === "em_transporte") {
    throw new Error(`PEDIDO #${task.display_id} JA FOI DESPACHADO! Ja esta em transporte.`)
  }

  if (task.romaneio_id) {
    throw new Error(`PEDIDO #${task.display_id} JA ESTA EM OUTRO ROMANEIO! Nao pode ser adicionado duas vezes.`)
  }

  if (task.status !== "conferido") {
    throw new Error(`Pedido #${task.display_id} nao esta conferido (status: ${task.status}). Conclua a conferencia antes.`)
  }

  await updateTask(task.id, { romaneio_id: romaneioId })

  const rom = await retrieveRomaneioById(romaneioId)
  await updateRomaneioRecord(romaneioId, { packages_count: (rom.packages_count || 0) + 1 })

  return {
    task,
    romaneio: { ...rom, packages_count: (rom.packages_count || 0) + 1 },
  }
}

export async function getRomaneioTasks(romaneioId: string) {
  return listTasks(
    { romaneio_id: romaneioId },
    { order: { display_id: "ASC" } }
  )
}

export async function closeRomaneio(romaneioId: string, closedBy?: string) {
  const tasks = await listTasks({ romaneio_id: romaneioId })

  for (const task of tasks) {
    await updateTask(task.id, {
      status: "em_transporte",
      shipped_at: new Date(),
    })
  }

  await updateRomaneioRecord(romaneioId, {
    status: "fechado",
    closed_at: new Date(),
    closed_by: closedBy,
  })

  return {
    romaneio: await retrieveRomaneioById(romaneioId),
    tasks_count: tasks.length,
    tasks: tasks.map((t) => ({
      id: t.id,
      order_id: t.order_id,
      display_id: t.display_id,
      tracking_code: t.tracking_code,
      customer_email: t.customer_email,
    })),
  }
}

export async function listOpenRomaneios() {
  return listRomaneios(
    { status: "aberto" },
    { order: { created_at: "DESC" } }
  )
}

export async function removeFromRomaneio(taskId: string) {
  const task = await retrieveTask(taskId)
  if (!task.romaneio_id) throw new Error("Pedido nao esta em nenhum romaneio")

  const romaneioId = task.romaneio_id
  await updateTask(taskId, { romaneio_id: null as any })

  const rom = await retrieveRomaneioById(romaneioId)
  await updateRomaneioRecord(romaneioId, {
    packages_count: Math.max(0, (rom.packages_count || 0) - 1),
  })
}

// ========== STATS ==========

// ========== EXPORTS FOR API ROUTE ==========

export async function list(status?: string) {
  const filters: Record<string, any> = {}
  if (status) filters.status = status
  return listTasks(filters, { order: { created_at: "DESC" }, take: 200 })
}

export async function retrieve(id: string) {
  return retrieveTask(id)
}

export async function listFulfillmentTaskItems(filters: Record<string, any>) {
  return listTaskItems(filters, { order: { location: "ASC" } })
}

export async function getStats() {
  const all = await listTasks({}, { take: 10000 })
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return {
    aguardando_separacao: all.filter((t) => t.status === "aguardando_separacao").length,
    em_separacao: all.filter((t) => t.status === "em_separacao").length,
    aguardando_conferencia: all.filter((t) => t.status === "aguardando_conferencia").length,
    conferido: all.filter((t) => t.status === "conferido").length,
    em_transporte: all.filter((t) => t.status === "em_transporte").length,
    despachados_hoje: all.filter(
      (t) => t.status === "em_transporte" && t.shipped_at && new Date(t.shipped_at) >= today
    ).length,
    total: all.length,
  }
}
