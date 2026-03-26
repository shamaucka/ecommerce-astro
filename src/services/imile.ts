
import { createHash } from "crypto"

// ========== iMILE OPEN API v1.3.1 ==========

const IMILE_SECRET_KEY = process.env.IMILE_SECRET_KEY || ""
const IMILE_CUSTOMER_ID = process.env.IMILE_CUSTOMER_ID || ""
const IMILE_ENV = process.env.IMILE_ENV || "test"

const BASE_URL =
  IMILE_ENV === "production"
    ? "https://openapi.imile.com"
    : "https://openapi.52imile.cn"

// ========== TOKEN CACHE ==========
// Cache per-process - resets on deploy/restart
let _tokenCache: { token: string; expiresAt: number } | null = null

/**
 * Generate iMile sign according to their documentation (pages 33-38):
 * 1. Sort body keys (excluding 'param' and 'sign') in ASCII order
 * 2. Concatenate: secretKey + sorted(key+value pairs) + JSON(param) + secretKey
 * 3. MD5 hash -> UPPERCASE
 */
function generateSign(body: Record<string, any>): string {
  // Get all keys except 'param' and 'sign', sort them
  const keys = Object.keys(body)
    .filter((k) => k !== "param" && k !== "sign")
    .sort()

  // Build concatenation: secretKey + key1value1 + key2value2 + ... + JSON(param) + secretKey
  const parts: string[] = [IMILE_SECRET_KEY]

  for (const key of keys) {
    parts.push(key)
    parts.push(String(body[key]))
  }

  // Add param as compact JSON - use exact same serialization as what gets sent
  if (body.param !== undefined) {
    const paramJson = JSON.stringify(body.param)
    parts.push(paramJson)
  }

  // Add secretKey at the end
  parts.push(IMILE_SECRET_KEY)

  const signStr = parts.join("")
  const sign = createHash("md5").update(signStr, "utf8").digest("hex").toUpperCase()
  // Debug: log sign details to help troubleshoot 401
  console.log("[iMile] sign keys:", keys.join(","), "| secretKey len:", IMILE_SECRET_KEY.length, "| signStr len:", signStr.length, "| sign:", sign)
  return sign
}

async function imileRequest(path: string, param: Record<string, any>, accessToken?: string) {
  const token = accessToken || (await getAccessToken())

  const body: Record<string, any> = {
    accessToken: token,
    customerId: IMILE_CUSTOMER_ID,
    signMethod: "MD5",
    format: "json",
    version: "1.0.0",
    timestamp: String(Date.now()),
    timeZone: "-3",
    param: param,
  }

  // Generate sign from body
  body.sign = generateSign(body)

  const jsonBody = JSON.stringify(body)
  console.log("[iMile] Request", path, "| body length:", jsonBody.length, "| param JSON:", JSON.stringify(body.param).substring(0, 300))

  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonBody,
  })

  const data = await res.json()
  console.log("[iMile] Response", path, "| code:", data.code, "| message:", data.message)
  if (data.code !== "200" && data.code !== 200) {
    throw new Error("iMile error " + data.code + ": " + (data.message || JSON.stringify(data)))
  }

  return data
}

// ========== AUTH ==========

export async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const param = { grantType: "clientCredential" }

  const body: Record<string, any> = {
    customerId: IMILE_CUSTOMER_ID,
    signMethod: "MD5",
    format: "json",
    version: "1.0.0",
    timestamp: String(Date.now()),
    timeZone: "-3",
    param: param,
  }

  // Generate sign
  body.sign = generateSign(body)

  const res = await fetch(BASE_URL + "/auth/accessToken/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.code !== "200" && data.code !== 200) {
    throw new Error("iMile auth failed: " + data.code + " - " + (data.message || JSON.stringify(data)))
  }

  const token = data.data?.accessToken || data.data
  console.log("[iMile] Auth response code:", data.code, "| token type:", typeof token, "| token:", String(token).substring(0, 30) + "...")
  _tokenCache = { token, expiresAt: Date.now() + 7000000 } // ~2hrs
  return token
}

// ========== CREATE ORDER ==========

export async function createOrder(orderData: {
  orderNo: string
  consigneeName: string
  consigneePhone: string
  consigneeCpf?: string
  consigneeAddress: string
  consigneeCity: string
  consigneeZipCode: string
  weight: number
  length?: number
  width?: number
  height?: number
  declaredValue?: number
  productValue?: number
  items: Array<{
    skuName: string
    skuNo?: string
    skuQty: number
    skuDeclaredValue: number
    skuWeight?: number
  }>
}) {
  const param = {
    orderNo: orderData.orderNo,
    orderType: "100",
    senderInfo: {
      addressType: "seller",
      contactCompany: "Tess Quadros",
      contacts: "Tess Quadros",
      phone: "47999887766",
      country: "BRA",
      province: "SC",
      city: "Gaspar",
      address: "Rodovia Jorge Lacerda 2670",
      zipCode: "89115100",
      taxID: "53768405000130",
      taxIDType: "2",
      stateRegisterNo: "262795078",
    },
    consigneeInfo: {
      addressType: "customer",
      contacts: orderData.consigneeName,
      phone: orderData.consigneePhone,
      country: "BRA",
      province: orderData.consigneeState || "",
      city: orderData.consigneeCity,
      address: orderData.consigneeAddress,
      zipCode: orderData.consigneeZipCode,
      taxID: orderData.consigneeCpf || "",
      taxIDType: orderData.consigneeCpf && orderData.consigneeCpf.length > 11 ? "2" : "1",
    },
    packageInfo: {
      goodsType: "Normal",
      paymentMethod: "PPD",
      collectingMoney: "0",
      clientDeclaredValue: String(Math.min(orderData.declaredValue || 0, 999).toFixed(2)),
      clientDeclaredCurrency: "Local",
      grossWeight: String(Math.min(orderData.weight || 0.8, 999).toFixed(3)),
      totalVolume: String(Math.min(Math.round((orderData.length || 95) * (orderData.width || 65) * (orderData.height || 5)), 999999).toFixed(2)),
    },
    skuInfos: orderData.items.map((item) => ({
      skuName: item.skuName,
      skuNo: item.skuNo || "",
      skuQty: String(item.skuQty),
      skuDeclaredValue: String(item.skuDeclaredValue),
      skuWeight: String(item.skuWeight || 0),
    })),
  }

  return imileRequest("/client/order/v2/createOrder", param)
}

// ========== TRACK ==========

export async function trackOrder(orderNo: string) {
  return imileRequest("/client/track/getOne", {
    orderType: "1",
    language: "2",
    orderNo: orderNo,
  })
}

export async function trackBatch(orderNos: string[]) {
  if (orderNos.length > 100) throw new Error("Max 100 orders per batch")
  return imileRequest("/client/track/list", {
    orderType: "1",
    language: "2",
    orderNo: orderNos,
  })
}

// ========== PRICING / FREIGHT QUOTE ==========

export async function getPricing(data: {
  senderZipCode: string
  receiverZipCode: string
  weight: number
  length?: number
  width?: number
  height?: number
  declaredValue?: number
}) {
  const param: Record<string, any> = {
    senderInfo: {
      zipCode: data.senderZipCode,
      country: "BRA",
    },
    consigneeInfo: {
      zipCode: data.receiverZipCode,
      country: "BRA",
    },
    packageInfo: {
      grossWeight: String(data.weight || 0.5),
      length: String(data.length || 30),
      width: String(data.width || 20),
      high: String(data.height || 10),
      clientDeclaredValue: String(data.declaredValue || 0),
      clientDeclaredCurrency: "Local",
    },
  }

  try {
    const result = await imileRequest("/client/order/pricing", param)
    return result.data
  } catch (e: any) {
    // Fallback: try alternative endpoint
    try {
      const result2 = await imileRequest("/client/order/queryFreight", param)
      return result2.data
    } catch {
      throw e
    }
  }
}

// ========== SHIPPING LABEL ==========

export async function getShippingLabel(expressNo: string) {
  return imileRequest("/client/order/reprintOrder", {
    orderCode: expressNo,
    orderCodeType: 2,
  })
}

// ========== UPLOAD INVOICE ==========

export async function uploadInvoice(
  waybillNo: string,
  invoiceBase64: string,
  invoiceType: string,
  accesskey: string,
  invoiceNo?: string,
  invoiceAmount?: string
) {
  return imileRequest("/order/attachment/batchUploadInvoice", {
    waybillNo: waybillNo,
    invoiceList: [
      {
        contentBase64: invoiceBase64,
        fileSuffix: "xml",
        invoiceType: invoiceType,
        accesskey: accesskey,
        invoiceNo: invoiceNo || "",
        invoiceAmount: invoiceAmount || "0",
      },
    ],
  })
}
