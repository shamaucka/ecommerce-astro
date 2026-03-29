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

async function paypalRequest(path: string, method = "GET", body?: any, extraHeaders?: Record<string, string>) {
  const token = await getAccessToken()
  const res = await fetch(PAYPAL_BASE + path, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
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
  // PayPal requires PayPal-Request-Id header when payment_source is specified
  const requestId = params.orderId + "-" + Date.now()
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
  }, { "PayPal-Request-Id": requestId })

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

/**
 * Create PayPal Plus payment (v1 API - Brazilian iframe)
 */
export async function createPlusPayment(params: {
  orderId: string
  displayId: string
  amount: number // cents
  customerName: string
  customerEmail: string
  customerCpf: string
}) {
  const token = await getAccessToken()
  const appUrl = "https://tessquadros.com.br"
  const [firstName, ...lastParts] = params.customerName.trim().split(" ")
  const lastName = lastParts.join(" ") || firstName
  const totalBRL = (params.amount / 100).toFixed(2)

  const res = await fetch(`${PAYPAL_BASE}/v1/payments/payment`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `pp-${params.orderId}`,
    },
    body: JSON.stringify({
      intent: "sale",
      payer: {
        payment_method: "paypal",
        payer_info: {
          tax_id: params.customerCpf.replace(/\D/g, ""),
          tax_id_type: "BR_CPF",
          email: params.customerEmail,
          first_name: firstName,
          last_name: lastName,
        },
      },
      transactions: [{
        amount: { total: totalBRL, currency: "BRL" },
        description: `Pedido #${params.displayId} - Tess Quadros`,
        custom: params.orderId,
        payment_options: { allowed_payment_method: "IMMEDIATE_PAY" },
      }],
      redirect_urls: {
        return_url: `${appUrl}/checkout?paypal=success`,
        cancel_url: `${appUrl}/checkout?paypal=cancel`,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`PayPal Plus erro ao criar payment: ${res.status} — ${errText}`)
  }

  const data = await res.json()
  const approvalLink = data.links?.find((l: any) => l.rel === "approval_url")
  if (!approvalLink?.href) {
    throw new Error("PayPal Plus: approval_url nao retornada. Conta pode nao ter PPPlus habilitado.")
  }

  return { paymentId: data.id as string, approvalUrl: approvalLink.href as string }
}

/**
 * Execute PayPal Plus payment after iframe confirmation
 */
export async function executePlusPayment(paymentId: string, payerId: string) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/payments/payment/${paymentId}/execute`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payer_id: payerId }),
  })

  const data = await res.json()
  if (data.state !== "approved") {
    const detail = data.details?.[0]?.issue || data.message || "Pagamento nao aprovado pelo banco"
    throw new Error(detail)
  }

  const sale = data.transactions?.[0]?.related_resources?.[0]?.sale
  return { paid: true, saleId: sale?.id || data.id, state: data.state as string }
}
