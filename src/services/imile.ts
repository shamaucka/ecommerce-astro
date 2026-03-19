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

// Sign = MD5(secretKey + JSON.stringify(param)) => UPPERCASE
function generateSign(param: Record<string, any>): string {
  const paramJson = JSON.stringify(param)
  return crypto
    .createHash("md5")
    .update(IMILE_SECRET_KEY + paramJson)
    .digest("hex")
    .toUpperCase()
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
    timestamp: Date.now(),
    timeZone: "-3",
    param,
  }

  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await res.json()
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
  const sign = generateSign(param)

  const body = {
    customerId: IMILE_CUSTOMER_ID,
    sign: sign,
    signMethod: "MD5",
    format: "json",
    version: "1.0.0",
    timestamp: Date.now(),
    timeZone: "-3",
    param: param,
  }

  const res = await fetch(BASE_URL + "/auth/accessToken/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.code !== "200" && data.code !== 200) {
    // Try alternative sign: MD5(param_json + secretKey) instead of MD5(secretKey + param_json)
    const altSign = crypto
      .createHash("md5")
      .update(JSON.stringify(param) + IMILE_SECRET_KEY)
      .digest("hex")
      .toUpperCase()

    const body2 = { ...body, sign: altSign, timestamp: Date.now() }
    const res2 = await fetch(BASE_URL + "/auth/accessToken/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body2),
    })

    const data2 = await res2.json()
    if (data2.code !== "200" && data2.code !== 200) {
      throw new Error("iMile auth failed. Code: " + data.code + " / " + data2.code + " Msg: " + (data.message || "") + " / " + (data2.message || ""))
    }

    const token2 = data2.data?.accessToken || data2.data
    _tokenCache = { token: token2, expiresAt: Date.now() + 7000000 }
    return token2
  }

  const token = data.data?.accessToken || data.data
  _tokenCache = { token, expiresAt: Date.now() + 7000000 }
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
  consigneeCountry?: string
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
      contacts: process.env.STORE_NAME || "Tess Quadros",
      phone: process.env.STORE_PHONE || "",
      country: "BRA",
      city: process.env.STORE_CITY || "",
      address: process.env.STORE_ADDRESS || "",
      zipCode: process.env.STORE_ZIPCODE || "",
      taxID: process.env.STORE_CNPJ || "",
      taxIDType: "2",
    },
    consigneeInfo: {
      addressType: "customer",
      contacts: orderData.consigneeName,
      phone: orderData.consigneePhone,
      country: "BRA",
      city: orderData.consigneeCity,
      address: orderData.consigneeAddress,
      zipCode: orderData.consigneeZipCode,
      taxID: orderData.consigneeCpf || "",
      taxIDType: "1",
    },
    packageInfo: {
      goodsType: "Normal",
      paymentMethod: "PPD",
      collectingMoney: "0",
      clientDeclaredValue: String(orderData.declaredValue || 0),
      clientDeclaredCurrency: "Local",
      productValue: String(orderData.productValue || orderData.declaredValue || 0),
      productValueCurrency: "Local",
      grossWeight: String(orderData.weight),
      length: String(orderData.length || 0),
      width: String(orderData.width || 0),
      high: String(orderData.height || 0),
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
  const param = {
    orderType: "1",
    language: "2",
    orderNo: orderNo,
  }
  return imileRequest("/client/track/getOne", param)
}

export async function trackBatch(orderNos: string[]) {
  if (orderNos.length > 100) throw new Error("Max 100 orders per batch")
  const param = {
    orderType: "1",
    language: "2",
    orderNo: orderNos,
  }
  return imileRequest("/client/track/list", param)
}

// ========== SHIPPING LABEL ==========

export async function getShippingLabel(orderCode: string) {
  const param = {
    orderCode: orderCode,
    orderCodeType: 1,
  }
  return imileRequest("/client/order/getOrderLabel", param)
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
  const param = {
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
  }
  return imileRequest("/order/attachment/batchUploadInvoice", param)
}
