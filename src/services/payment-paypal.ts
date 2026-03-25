/**
 * PayPal - Credit card payment integration
 * Docs: https://developer.paypal.com/docs/api/orders/v2/
 */

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_PROD_CLIENT_ID || ""
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_PROD_CLIENT_SECRET || ""
const PAYPAL_ENV = process.env.PAYPAL_ENV || "production"
const PAYPAL_BASE = PAYPAL_ENV === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com"

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.token

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  const data = await res.json()
  if (!data.access_token) throw new Error("PayPal auth failed: " + (data.error_description || "unknown"))

  _tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return data.access_token
}

async function paypalRequest(path: string, method = "GET", body?: any) {
  const token = await getAccessToken()
  const res = await fetch(PAYPAL_BASE + path, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

/**
 * Create a PayPal order for card payment
 */
export async function createOrder(params: {
  orderId: string
  displayId: string
  amount: number // in cents
  customerEmail: string
  items: Array<{ name: string; quantity: number; unitPrice: number }>
  shippingCost?: number
}) {
  const totalBRL = (params.amount / 100).toFixed(2)
  const itemsTotal = params.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const shippingBRL = ((params.shippingCost || 0) / 100).toFixed(2)
  const itemsTotalBRL = (itemsTotal / 100).toFixed(2)

  const data = await paypalRequest("/v2/checkout/orders", "POST", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: params.orderId,
      description: `Pedido #${params.displayId} - Tess Quadros`,
      amount: {
        currency_code: "BRL",
        value: totalBRL,
        breakdown: {
          item_total: { currency_code: "BRL", value: itemsTotalBRL },
          shipping: { currency_code: "BRL", value: shippingBRL },
        },
      },
      items: params.items.map(i => ({
        name: i.name.substring(0, 127),
        quantity: String(i.quantity),
        unit_amount: { currency_code: "BRL", value: (i.unitPrice / 100).toFixed(2) },
        category: "PHYSICAL_GOODS",
      })),
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Tess Quadros",
          locale: "pt-BR",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: "https://tessquadros.com.br/checkout?status=success",
          cancel_url: "https://tessquadros.com.br/checkout?status=cancel",
        },
      },
    },
  })

  if (data.name === "INVALID_REQUEST" || data.name === "UNPROCESSABLE_ENTITY") {
    throw new Error(data.details?.[0]?.description || data.message || "Erro PayPal")
  }

  const approveLink = data.links?.find((l: any) => l.rel === "approve")?.href
  const captureLink = data.links?.find((l: any) => l.rel === "capture")?.href

  return {
    paypalOrderId: data.id,
    status: data.status,
    approveUrl: approveLink || null,
    captureUrl: captureLink || null,
  }
}

/**
 * Capture a PayPal order after approval
 */
export async function captureOrder(paypalOrderId: string) {
  const data = await paypalRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, "POST")

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    status: data.status, // COMPLETED
    captureId: capture?.id,
    paid: data.status === "COMPLETED",
    paidAmount: capture?.amount?.value,
    payerEmail: data.payer?.email_address,
  }
}

/**
 * Process card payment directly (create + capture in one step)
 * Uses PayPal Orders API with card payment source
 */
export async function processCard(params: {
  orderId: string
  displayId: string
  amount: number // cents
  customerEmail: string
  card: { number: string; expiry_month: string; expiry_year: string; cvv: string; name: string }
  items: Array<{ name: string; quantity: number; unitPrice: number }>
  shippingCost?: number
}) {
  const totalBRL = (params.amount / 100).toFixed(2)
  const shippingBRL = ((params.shippingCost || 0) / 100).toFixed(2)
  const itemsTotal = params.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const itemsTotalBRL = (itemsTotal / 100).toFixed(2)

  // Create order with card payment source - auto-captures
  const data = await paypalRequest("/v2/checkout/orders", "POST", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: params.orderId,
      description: `Pedido #${params.displayId} - Tess Quadros`,
      amount: {
        currency_code: "BRL",
        value: totalBRL,
        breakdown: {
          item_total: { currency_code: "BRL", value: itemsTotalBRL },
          shipping: { currency_code: "BRL", value: shippingBRL },
        },
      },
      items: params.items.map(i => ({
        name: i.name.substring(0, 127),
        quantity: String(i.quantity),
        unit_amount: { currency_code: "BRL", value: (i.unitPrice / 100).toFixed(2) },
        category: "PHYSICAL_GOODS",
      })),
    }],
    payment_source: {
      card: {
        number: params.card.number,
        expiry: params.card.expiry_year + "-" + params.card.expiry_month,
        security_code: params.card.cvv,
        name: params.card.name,
        billing_address: {
          country_code: "BR",
        },
      },
    },
  })

  if (data.name === "INVALID_REQUEST" || data.name === "UNPROCESSABLE_ENTITY") {
    const detail = data.details?.[0]?.description || data.message || "Cartao recusado"
    throw new Error(detail)
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    paypalOrderId: data.id,
    status: data.status,
    paid: data.status === "COMPLETED",
    captureId: capture?.id,
    paidAmount: capture?.amount?.value,
  }
}

/**
 * Get order details
 */
export async function getOrder(paypalOrderId: string) {
  return paypalRequest(`/v2/checkout/orders/${paypalOrderId}`)
}
