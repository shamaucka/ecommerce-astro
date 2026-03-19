import crypto from "crypto"

// ========== iMILE OPEN API v1.3.1 ==========

const IMILE_SECRET_KEY = process.env.IMILE_SECRET_KEY || ""
const IMILE_CUSTOMER_ID = process.env.IMILE_CUSTOMER_ID || ""
const IMILE_ENV = process.env.IMILE_ENV || "test"

const BASE_URL =
  IMILE_ENV === "production"
    ? "https://openapi.imile.com"
    : "https://openapi.52imile.cn"

// ========== TOKEN CACHE ==========
let _tokenCache: { token: string; expiresAt: number } | null = null

function generateSign(param: Record<string, any>): string {
  const json = JSON.stringify(param)
  return crypto.createHash("md5").update(IMILE_SECRET_KEY + json).digest("hex")
}

function buildHeaders() {
  return { "Content-Type": "application/json" }
}

async function imileRequest(path: string, param: Record<string, any>, accessToken?: string) {
  const token = accessToken || (await getAccessToken())
  const body = {
    accessToken: token,
    customerId: IMILE_CUSTOMER_ID,
    sign: generateSign(param),
    signMethod: "MD5",
    format: "json",
    version: "1.0.0",
    timestamp: Date.now().toString(),
    timeZone: "-3",
    param,
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`iMile API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (data.code !== "200" && data.code !== 200) {
    throw new Error(`iMile API error: ${data.code} - ${data.message || JSON.stringify(data)}`)
  }

  return data
}

// ========== AUTH ==========

export async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const param = {
    grantType: "clientCredential",
    customerId: IMILE_CUSTOMER_ID,
  }

  const sign = generateSign(param)

  const body = {
    customerId: IMILE_CUSTOMER_ID,
    sign,
    signMethod: "MD5",
    format: "json",
    version: "1.0.0",
    timestamp: Date.now().toString(),
    timeZone: "-3",
    param,
  }

  const res = await fetch(`${BASE_URL}/auth/accessToken/grant`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`iMile auth error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (data.code !== "200" && data.code !== 200) {
    throw new Error(`iMile auth error: ${data.code} - ${data.message || "falha ao obter token"}`)
  }

  const token = data.data?.accessToken || data.data
  // Cache for 2 hours
  _tokenCache = { token, expiresAt: Date.now() + 2 * 60 * 60 * 1000 }
  return token
}

// ========== CREATE ORDER ==========

export async function createOrder(orderData: {
  orderNo: string
  consigneeName: string
  consigneePhone: string
  consigneeAddress: string
  consigneeCity: string
  consigneeState: string
  consigneeZipCode: string
  consigneeCountry?: string
  weight: number
  length?: number
  width?: number
  height?: number
  declaredValue?: number
  productCode?: string
  items: Array<{
    skuName: string
    skuCode: string
    quantity: number
    declaredValue: number
    weight: number
  }>
}) {
  const param = {
    orderNo: orderData.orderNo,
    orderType: 100,
    senderInfo: {
      senderName: process.env.STORE_NAME || "Loja",
      senderPhone: process.env.STORE_PHONE || "",
      senderAddress: process.env.STORE_ADDRESS || "",
      senderCity: process.env.STORE_CITY || "",
      senderState: process.env.STORE_STATE || "",
      senderZipCode: process.env.STORE_ZIPCODE || "",
      senderCountry: "BR",
    },
    consigneeInfo: {
      consigneeName: orderData.consigneeName,
      consigneePhone: orderData.consigneePhone,
      consigneeAddress: orderData.consigneeAddress,
      consigneeCity: orderData.consigneeCity,
      consigneeState: orderData.consigneeState,
      consigneeZipCode: orderData.consigneeZipCode,
      consigneeCountry: orderData.consigneeCountry || "BR",
    },
    packageInfo: {
      weight: orderData.weight,
      length: orderData.length || 0,
      width: orderData.width || 0,
      height: orderData.height || 0,
      declaredValue: orderData.declaredValue || 0,
    },
    skuInfos: orderData.items.map((item) => ({
      skuName: item.skuName,
      skuCode: item.skuCode,
      skuQuantity: item.quantity,
      declaredValue: item.declaredValue,
      weight: item.weight,
    })),
    productCode: orderData.productCode || process.env.IMILE_PRODUCT_CODE || "",
  }

  return imileRequest("/client/order/v2/createOrder", param)
}

// ========== TRACK ORDER ==========

export async function trackOrder(waybillNo: string) {
  const param = {
    orderNo: waybillNo,
    orderType: 1,
  }

  return imileRequest("/client/track/getOne", param)
}

// ========== TRACK BATCH ==========

export async function trackBatch(waybillNos: string[]) {
  if (waybillNos.length > 100) {
    throw new Error("iMile trackBatch aceita no maximo 100 waybills por chamada")
  }

  const param = {
    orderNoList: waybillNos,
    orderType: 1,
  }

  return imileRequest("/client/track/list", param)
}

// ========== GET SHIPPING LABEL ==========

export async function getShippingLabel(orderNo: string) {
  const param = {
    orderNo,
  }

  return imileRequest("/client/order/getOrderLabel", param)
}

// ========== UPLOAD INVOICE ==========

export async function uploadInvoice(
  waybillNo: string,
  invoiceXml: string,
  invoiceType: string,
  accessKey: string
) {
  const param = {
    waybillNo,
    invoiceXml,
    invoiceType,
    accessKey,
  }

  return imileRequest("/order/attachment/batchUploadInvoice", param)
}
