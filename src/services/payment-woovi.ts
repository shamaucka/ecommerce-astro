/**
 * Woovi (OpenPix) - PIX payment integration
 * Docs: https://developers.openpix.com.br/docs
 */

const WOOVI_APP_ID = process.env.WOOVI_APP_ID || process.env.WOOVI_SANDBOX_APP_ID || ""
const WOOVI_BASE = "https://api.openpix.com.br/api/v1"

async function wooviRequest(path: string, body?: any) {
  const res = await fetch(WOOVI_BASE + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Authorization": WOOVI_APP_ID,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

/**
 * Create a PIX charge
 */
export async function createPixCharge(params: {
  orderId: string
  displayId: string
  amount: number // in cents
  customerName: string
  customerEmail: string
  customerCpf?: string
}) {
  const correlationID = `tess-${params.orderId}-${Date.now()}`

  const data = await wooviRequest("/charge", {
    correlationID,
    value: params.amount,
    comment: `Pedido #${params.displayId} - Tess Quadros`,
    customer: {
      name: params.customerName,
      email: params.customerEmail,
      taxID: params.customerCpf?.replace(/\D/g, "") || undefined,
    },
    additionalInfo: [
      { key: "orderId", value: params.orderId },
      { key: "displayId", value: params.displayId },
    ],
  })

  if (data.error) {
    throw new Error(data.error || "Erro ao criar cobrança PIX")
  }

  return {
    chargeId: data.charge?.correlationID || correlationID,
    transactionId: data.charge?.transactionID,
    qrCodeImage: data.charge?.qrCodeImage,
    brCode: data.charge?.brCode,
    pixKey: data.charge?.pixKey,
    expiresAt: data.charge?.expiresDate,
    status: data.charge?.status,
  }
}

/**
 * Get charge status
 */
export async function getChargeStatus(correlationID: string) {
  const data = await wooviRequest(`/charge/${correlationID}`)
  return {
    status: data.charge?.status, // ACTIVE, COMPLETED, EXPIRED
    paid: data.charge?.status === "COMPLETED",
    paidAt: data.charge?.paidAt,
  }
}

/**
 * Validate webhook signature
 */
export function validateWebhook(payload: string, signature: string): boolean {
  // Dois webhooks (charge_completed + transaction_received) com HMACs diferentes
  const secrets = [
    process.env.WOOVI_WEBHOOK_SECRET_CHARGE,
    process.env.WOOVI_WEBHOOK_SECRET_TRANSACTION,
    process.env.WOOVI_WEBHOOK_SECRET, // fallback legado
  ].filter(Boolean)

  if (secrets.length === 0) return true // skip se nenhum secret configurado

  const crypto = require("crypto")
  return secrets.some((secret) => {
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex")
    return hmac === signature
  })
}
