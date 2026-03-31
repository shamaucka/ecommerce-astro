import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY || "")
const FROM = "Tess Quadros <pedidos@tessquadros.com.br>"
const SITE = "https://tessquadros.com.br"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// ═══════════════════════════════════════════
// BASE TEMPLATE
// ═══════════════════════════════════════════
function wrap(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f4ef;color:#0a0a0a;-webkit-text-size-adjust:100%}
.c{max-width:520px;margin:0 auto;padding:20px 12px}
.logo{text-align:center;padding:28px 0 20px}
.logo span{font-size:22px;font-weight:900;letter-spacing:-1px;color:#0a0a0a;text-transform:uppercase}
.box{background:#fff;border-radius:16px;padding:28px 24px;margin-bottom:12px;border:1px solid #e8e8e0}
h1{font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin:0 0 8px;line-height:1.2}
h2{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#999;margin:20px 0 6px}
p{font-size:14px;line-height:1.65;color:#555;margin:0 0 10px}
.row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f5f4ef;font-size:13px}
.row:last-child{border:none}
.total-row{border-top:2px solid #0a0a0a;margin-top:8px;padding-top:12px;text-align:right}
.total-row span{font-size:20px;font-weight:900}
.btn{display:inline-block;background:#0a0a0a;color:#ffffff!important;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;border-radius:8px;margin:12px 0}
.btn-outline{background:transparent;color:#0a0a0a!important;border:2px solid #0a0a0a}
.pill{display:inline-block;background:#f5f4ef;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666}
.track-box{background:#f3f0ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;margin:16px 0;text-align:center}
.track-code{font-size:18px;font-weight:900;font-family:'Courier New',monospace;color:#7c3aed;letter-spacing:2px}
.urgency{background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:14px;margin:12px 0;text-align:center}
.urgency p{color:#92400e;font-weight:700;font-size:13px;margin:0}
.ft{text-align:center;padding:20px 12px;font-size:11px;color:#aaa;line-height:1.6}
.ft a{color:#aaa}
</style></head><body>
<div class="c">
<div class="logo"><span>Tess Quadros</span></div>
${body}
<div class="ft">
<p>Tess Quadros — Quadros Decorativos Premium</p>
<p><a href="${SITE}">tessquadros.com.br</a> · <a href="mailto:tessquadros1@gmail.com">tessquadros1@gmail.com</a></p>
</div>
</div></body></html>`
}

function itemsBlock(items: any[]) {
  return items.map((i: any) => `
    <div class="row">
      <div><strong>${i.title || i.name || "Quadro"}</strong><br><span style="color:#999;font-size:11px">Qtd: ${i.quantity || 1}</span></div>
      <div style="text-align:right;font-weight:700">${fmt((i.unit_price || i.price || 0) * (i.quantity || 1))}</div>
    </div>`).join("")
}

// ═══════════════════════════════════════════
// 1. CONFIRMAÇÃO DE PEDIDO
// ═══════════════════════════════════════════
export async function sendOrderConfirmation(order: {
  display_id: string; customer_name: string; customer_email: string;
  items: any[]; total: number; subtotal: number; shipping_cost: number;
  discount_amount?: number; payment_method?: string;
  shipping_city?: string; shipping_state?: string;
}) {
  const pay = order.payment_method === "pix" ? "PIX (5% desc.)" : order.payment_method === "credit_card" ? "Cartao de Credito" : "---"

  const html = wrap(`
<div class="box">
  <h1>Pedido Confirmado</h1>
  <p>Ola <strong>${order.customer_name}</strong>, seu pagamento foi aprovado e seu pedido ja esta sendo preparado.</p>
  <p><span class="pill">Pedido #${order.display_id}</span> &nbsp; <span class="pill">${pay}</span></p>

  <h2>Seus Itens</h2>
  ${itemsBlock(order.items || [])}

  ${order.discount_amount ? `<div class="row"><span>Economia</span><span style="color:#16a34a;font-weight:700">-${fmt(order.discount_amount)}</span></div>` : ""}
  <div class="row"><span>Frete</span><span>${order.shipping_cost ? fmt(order.shipping_cost) : "<strong style='color:#16a34a'>Gratis</strong>"}</span></div>

  <div class="total-row"><span>${fmt(order.total)}</span></div>

  ${order.shipping_city ? `<h2>Entrega para</h2><p><strong>${order.shipping_city}/${order.shipping_state}</strong></p>` : ""}

  <p style="margin-top:20px;font-size:13px;color:#888">Voce recebera um email com o codigo de rastreio assim que despacharmos.</p>

  <div style="text-align:center"><a href="${SITE}/minhaconta" class="btn">Acompanhar Pedido</a></div>
</div>`)

  try {
    const r = await resend.emails.send({ from: FROM, to: order.customer_email, subject: `Pedido #${order.display_id} confirmado! — Tess Quadros`, html })
    console.log(`[Email] Confirmacao enviada para ${order.customer_email}`, r?.data?.id)
    return r
  } catch (e: any) { console.error("[Email] Confirmacao falhou:", e.message) }
}

// ═══════════════════════════════════════════
// 2. PEDIDO DESPACHADO (rastreio)
// ═══════════════════════════════════════════
export async function sendShippingNotification(order: {
  display_id: string; customer_name: string; customer_email: string;
  tracking_number: string; carrier?: string;
}) {
  const url = `https://www.imile.com/tracking?trackingNumber=${order.tracking_number}`

  const html = wrap(`
<div class="box">
  <h1>Seu Pedido Saiu!</h1>
  <p>Ola <strong>${order.customer_name}</strong>, o pedido <strong>#${order.display_id}</strong> acabou de ser despachado.</p>

  <div class="track-box">
    <h2 style="margin-top:0">Codigo de Rastreio</h2>
    <p class="track-code">${order.tracking_number}</p>
    <p style="font-size:11px;color:#888;margin:4px 0 0">Transportadora: ${order.carrier || "iMile"}</p>
  </div>

  <div style="text-align:center">
    <a href="${url}" class="btn">Rastrear Encomenda</a>
  </div>

  <p style="font-size:12px;color:#888;margin-top:16px">O prazo de entrega comeca a contar a partir de hoje. Acompanhe em tempo real pelo link acima.</p>
</div>`)

  try {
    const r = await resend.emails.send({ from: FROM, to: order.customer_email, subject: `Pedido #${order.display_id} enviado! — Tess Quadros`, html })
    console.log(`[Email] Despacho enviado para ${order.customer_email}`, r?.data?.id)
    return r
  } catch (e: any) { console.error("[Email] Despacho falhou:", e.message) }
}

// ═══════════════════════════════════════════
// 3. LEMBRETE PIX (pagamento pendente)
// ═══════════════════════════════════════════
export async function sendPixReminder(order: {
  display_id: string; customer_name: string; customer_email: string;
  total: number; brCode?: string; qrCodeImage?: string;
}) {
  const html = wrap(`
<div class="box">
  <h1>Falta pouco!</h1>
  <p>Ola <strong>${order.customer_name}</strong>, notamos que o pagamento do pedido <strong>#${order.display_id}</strong> ainda esta pendente.</p>

  <div class="urgency">
    <p>Seu pedido de <strong>${fmt(order.total)}</strong> esta reservado por tempo limitado</p>
  </div>

  ${order.qrCodeImage ? `<div style="text-align:center;margin:16px 0"><img src="${order.qrCodeImage}" alt="QR Code PIX" style="width:200px;height:200px;border-radius:8px" /></div>` : ""}

  ${order.brCode ? `<p style="font-size:11px;word-break:break-all;background:#f5f4ef;padding:10px;border-radius:8px;color:#666">Pix Copia e Cola:<br><strong style="color:#0a0a0a">${order.brCode}</strong></p>` : ""}

  <div style="text-align:center">
    <a href="${SITE}/minhaconta" class="btn">Finalizar Pagamento</a>
  </div>

  <p style="font-size:12px;color:#888">Caso ja tenha efetuado o pagamento, desconsidere este email. A confirmacao pode levar ate 5 minutos.</p>
</div>`)

  try {
    const r = await resend.emails.send({ from: FROM, to: order.customer_email, subject: `Seu pedido #${order.display_id} esta aguardando pagamento — Tess Quadros`, html })
    console.log(`[Email] PIX reminder enviado para ${order.customer_email}`, r?.data?.id)
    return r
  } catch (e: any) { console.error("[Email] PIX reminder falhou:", e.message) }
}

// ═══════════════════════════════════════════
// 4. CARRINHO ABANDONADO
// ═══════════════════════════════════════════
export async function sendCartAbandoned(data: {
  customer_email: string; customer_name?: string;
  items: Array<{ name: string; image?: string; price: number }>;
  total: number;
}) {
  const itemsHtml = data.items.map(i => `
    <div class="row">
      <div style="display:flex;align-items:center;gap:10px">
        ${i.image ? `<img src="${i.image}" style="width:48px;height:48px;border-radius:8px;object-fit:cover" alt="" />` : ""}
        <strong>${i.name}</strong>
      </div>
      <div style="font-weight:700">${fmt(i.price * 100)}</div>
    </div>`).join("")

  const html = wrap(`
<div class="box">
  <h1>Esqueceu algo?</h1>
  <p>Ola${data.customer_name ? ` <strong>${data.customer_name}</strong>` : ""}, voce deixou itens incriveis no carrinho.</p>

  <h2>Seus Itens</h2>
  ${itemsHtml}

  <div class="urgency">
    <p>Compre 2 quadros por <strong>R$ 150</strong> + Frete Gratis</p>
  </div>

  <div style="text-align:center">
    <a href="${SITE}/quadros" class="btn">Voltar ao Carrinho</a>
  </div>

  <p style="font-size:12px;color:#888;text-align:center">Parcelamos em ate 6x sem juros no cartao.</p>
</div>`)

  try {
    const r = await resend.emails.send({ from: FROM, to: data.customer_email, subject: `Voce esqueceu algo no carrinho — Tess Quadros`, html })
    console.log(`[Email] Carrinho abandonado enviado para ${data.customer_email}`, r?.data?.id)
    return r
  } catch (e: any) { console.error("[Email] Carrinho abandonado falhou:", e.message) }
}

// ═══════════════════════════════════════════
// 5. BOAS-VINDAS
// ═══════════════════════════════════════════
export async function sendWelcome(email: string, name: string) {
  const html = wrap(`
<div class="box">
  <h1>Bem-vindo a Tess!</h1>
  <p>Ola <strong>${name}</strong>, obrigado por sua compra!</p>
  <p>Na Tess Quadros, cada peca e produzida em canvas premium com impressao que nunca desbota. Montagem artesanal, bastidor de madeira e pronto para pendurar.</p>

  <div style="text-align:center;margin:20px 0">
    <a href="${SITE}/quadros" class="btn">Ver Colecao Completa</a>
  </div>

  <p style="font-size:13px;color:#888">Acompanhe seu pedido em <a href="${SITE}/minhaconta" style="color:#0a0a0a;font-weight:700">Minha Conta</a>. Duvidas? <a href="mailto:tessquadros1@gmail.com" style="color:#0a0a0a;font-weight:700">tessquadros1@gmail.com</a></p>
</div>`)

  try {
    const r = await resend.emails.send({ from: FROM, to: email, subject: `Bem-vindo a Tess Quadros!`, html })
    console.log(`[Email] Welcome enviado para ${email}`, r?.data?.id)
    return r
  } catch (e: any) { console.error("[Email] Welcome falhou:", e.message) }
}
