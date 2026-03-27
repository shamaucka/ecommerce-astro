import crypto from "crypto";

const PIXEL_ID = process.env.META_PIXEL_ID || "";
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || "";

function hash(value: string): string {
  if (!value) return "";
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function hashPhone(phone: string): string {
  const cleaned = "+55" + phone.replace(/\D/g, "");
  return crypto.createHash("sha256").update(cleaned).digest("hex");
}

export interface CAPIEventData {
  event_name: string;
  event_time: number;
  event_id?: string;
  event_source_url?: string;
  user_data: {
    em?: string;         // email (plain - will be hashed)
    ph?: string;         // phone (plain)
    fn?: string;         // first name
    ln?: string;         // last name
    zp?: string;         // zip
    ct?: string;         // city
    st?: string;         // state
    country?: string;
    external_id?: string;
    client_ip_address?: string;
    client_user_agent?: string;
    fbp?: string;
    fbc?: string;
  };
  custom_data?: {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_type?: string;
    content_name?: string;
    num_items?: number;
    order_id?: string;
  };
  action_source: "website";
}

export async function sendCAPIEvent(eventData: CAPIEventData): Promise<void> {
  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.log("[CAPI] Skipped - no credentials configured");
    return;
  }

  // Hash all PII
  const ud = eventData.user_data;
  const hashedUserData: any = {
    em: ud.em ? [hash(ud.em)] : undefined,
    ph: ud.ph ? [hashPhone(ud.ph)] : undefined,
    fn: ud.fn ? [hash(ud.fn)] : undefined,
    ln: ud.ln ? [hash(ud.ln)] : undefined,
    zp: ud.zp ? [hash(ud.zp.replace(/\D/g, ""))] : undefined,
    ct: ud.ct ? [hash(ud.ct)] : undefined,
    st: ud.st ? [hash(ud.st.toLowerCase())] : undefined,
    country: ud.country ? [hash(ud.country)] : ["br"],
    external_id: ud.external_id ? [hash(ud.external_id)] : undefined,
    client_ip_address: ud.client_ip_address,
    client_user_agent: ud.client_user_agent,
    fbp: ud.fbp,
    fbc: ud.fbc,
  };

  // Remove undefined keys
  Object.keys(hashedUserData).forEach(k => { if (!hashedUserData[k]) delete hashedUserData[k]; });

  const payload = {
    data: [{
      event_name: eventData.event_name,
      event_time: eventData.event_time || Math.floor(Date.now() / 1000),
      event_id: eventData.event_id,
      event_source_url: eventData.event_source_url || "https://tessquadros.com.br",
      action_source: "website",
      user_data: hashedUserData,
      custom_data: eventData.custom_data,
    }],
    test_event_code: process.env.META_CAPI_TEST_CODE || undefined,
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) console.error("[CAPI Error]", data.error);
    else console.log(`[CAPI] ${eventData.event_name} sent, fbe:`, data.events_received);
  } catch (err) {
    console.error("[CAPI Send Error]", err);
  }
}

// Convenience: Purchase event
export async function capiPurchase(params: {
  orderId: string;
  value: number; // BRL cents -> converts to float
  email?: string;
  phone?: string;
  name?: string;
  zip?: string;
  city?: string;
  state?: string;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  eventId?: string;
  contentIds?: string[];
}) {
  const [fn, ...lnParts] = (params.name || "").split(" ");
  await sendCAPIEvent({
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId || `purchase-${params.orderId}`,
    event_source_url: "https://tessquadros.com.br/checkout",
    action_source: "website",
    user_data: {
      em: params.email,
      ph: params.phone,
      fn: fn || undefined,
      ln: lnParts.join(" ") || undefined,
      zp: params.zip,
      ct: params.city,
      st: params.state,
      country: "br",
      external_id: params.orderId,
      client_ip_address: params.ip,
      client_user_agent: params.userAgent,
      fbp: params.fbp,
      fbc: params.fbc,
    },
    custom_data: {
      value: params.value / 100,
      currency: "BRL",
      content_ids: params.contentIds || [],
      content_type: "product",
      order_id: params.orderId,
    },
  });
}
