import crypto from "crypto";

const PIXEL_ID = process.env.TIKTOK_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.TIKTOK_EVENTS_API_TOKEN || "";

function hash(v: string): string {
  if (!v) return "";
  return crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

export async function sendTikTokEvent(params: {
  event: string;
  event_id?: string;
  email?: string;
  phone?: string;
  ttclid?: string;
  ip?: string;
  userAgent?: string;
  url?: string;
  properties?: {
    value?: number;
    currency?: string;
    content_id?: string;
    content_name?: string;
    order_id?: string;
    quantity?: number;
  };
}) {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const context: any = {
    ad: { callback: params.ttclid },
    page: { url: params.url || "https://tessquadros.com.br" },
    user: {
      email: params.email ? hash(params.email) : undefined,
      phone_number: params.phone ? hash("+55" + params.phone.replace(/\D/g, "")) : undefined,
      external_id: params.email ? hash(params.email) : undefined,
    },
    ip: params.ip,
    user_agent: params.userAgent,
  };

  // Remove empty
  if (!context.user.email) delete context.user.email;
  if (!context.user.phone_number) delete context.user.phone_number;
  if (!context.ad.callback) delete context.ad;

  const payload = {
    pixel_code: PIXEL_ID,
    test_event_code: process.env.TIKTOK_EVENTS_TEST_CODE || undefined,
    timestamp: new Date().toISOString(),
    context,
    events: [{
      event: params.event,
      event_id: params.event_id || `tt-${Date.now()}`,
      event_time: Math.floor(Date.now() / 1000),
      properties: {
        currency: "BRL",
        content_type: "product",
        ...params.properties,
      },
    }],
  };

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.code !== 0) console.error("[TikTok Events API]", data.message);
    else console.log(`[TikTok] ${params.event} sent`);
  } catch (err) {
    console.error("[TikTok Events API Error]", err);
  }
}

export async function tiktokPurchase(params: {
  orderId: string;
  value: number; // cents
  email?: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
  ttclid?: string;
}) {
  await sendTikTokEvent({
    event: "CompletePayment",
    event_id: `purchase-${params.orderId}`,
    email: params.email,
    phone: params.phone,
    ttclid: params.ttclid,
    ip: params.ip,
    userAgent: params.userAgent,
    url: "https://tessquadros.com.br/checkout",
    properties: {
      value: params.value / 100,
      currency: "BRL",
      order_id: params.orderId,
    },
  });
}
