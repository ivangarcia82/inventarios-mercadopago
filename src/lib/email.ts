// src/lib/email.ts
// Wrapper de Resend con fallback a console.log cuando no hay API key (dev).
import { Resend } from "resend";

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL ?? "Mercado Pago Inventario <onboarding@resend.dev>";

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail({ to, subject, html, text }: SendArgs) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) {
    console.warn("[email] sin destinatarios, se omite envío:", subject);
    return { ok: false as const, reason: "no-recipients" };
  }

  if (!resend) {
    console.log("[email:stub] →", recipients.join(", "), "|", subject);
    console.log(text ?? html.replace(/<[^>]+>/g, ""));
    return { ok: true as const, stub: true as const };
  }

  try {
    const res = await resend.emails.send({
      from: FROM,
      to: recipients,
      subject,
      html,
      text,
    });
    if (res.error) {
      console.error("[email] error resend:", res.error);
      return { ok: false as const, reason: res.error.message };
    }
    return { ok: true as const, id: res.data?.id };
  } catch (e: any) {
    console.error("[email] excepción:", e);
    return { ok: false as const, reason: e?.message ?? "unknown" };
  }
}

// ─── Plantillas ─────────────────────────────────────────────────────────

interface RequestSummary {
  folio: string;
  requesterName: string;
  deliveryMethod: "PICKUP" | "SHIPPING" | string;
  shippingAddress?: string | null;
  receiverName?: string | null;
  notes?: string | null;
  trackingNumber?: string | null;
  items: { name: string; quantity: number; unit: string }[];
}

function itemsListHtml(items: RequestSummary["items"]) {
  return `<ul style="margin:0;padding-left:18px">${items
    .map(
      (i) =>
        `<li><strong>${i.quantity} ${i.unit}</strong> — ${escapeHtml(i.name)}</li>`
    )
    .join("")}</ul>`;
}

function itemsListText(items: RequestSummary["items"]) {
  return items.map((i) => `  • ${i.quantity} ${i.unit} — ${i.name}`).join("\n");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

const BRAND_HEADER = `
<div style="background:#FFE600;padding:18px 24px;border-radius:12px 12px 0 0;">
  <strong style="color:#2D3277;font-size:18px;letter-spacing:-.01em;">Mercado Pago · Inventario</strong>
</div>`;

function wrap(inner: string) {
  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.5;">
  ${BRAND_HEADER}
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
    ${inner}
  </div>
</div>`;
}

export async function notifyNewRequest(args: {
  to: string[];
  request: RequestSummary;
}) {
  const { to, request } = args;
  const method =
    request.deliveryMethod === "SHIPPING" ? "Envío" : "Pick-up";

  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#2D3277;">Nueva solicitud ${escapeHtml(request.folio)}</h2>
    <p style="margin:0 0 16px;color:#6b7280;">${escapeHtml(request.requesterName)} solicitó material — método: <strong>${method}</strong>.</p>
    ${request.shippingAddress ? `<p style="margin:0 0 12px;"><strong>Dirección:</strong> ${escapeHtml(request.shippingAddress)}</p>` : ""}
    ${request.receiverName ? `<p style="margin:0 0 12px;"><strong>Recibe:</strong> ${escapeHtml(request.receiverName)}</p>` : ""}
    ${request.notes ? `<p style="margin:0 0 12px;"><strong>Notas:</strong> ${escapeHtml(request.notes)}</p>` : ""}
    <p style="margin:16px 0 8px;font-weight:600;">Items:</p>
    ${itemsListHtml(request.items)}
  `);

  const text = `Nueva solicitud ${request.folio}
${request.requesterName} solicitó material (método: ${method}).
${request.shippingAddress ? `Dirección: ${request.shippingAddress}\n` : ""}${request.receiverName ? `Recibe: ${request.receiverName}\n` : ""}${request.notes ? `Notas: ${request.notes}\n` : ""}
Items:
${itemsListText(request.items)}`;

  return sendEmail({
    to,
    subject: `[Inventario MP] Nueva solicitud ${request.folio} — ${method}`,
    html,
    text,
  });
}

export async function notifyReadyOrShipped(args: {
  to: string[];
  request: RequestSummary;
  status: "READY" | "SHIPPED";
}) {
  const { to, request, status } = args;
  const isShipped = status === "SHIPPED";
  const trackingUrl = request.trackingNumber
    ? `https://www.paquetexpress.com.mx/rastreo/${encodeURIComponent(request.trackingNumber)}`
    : null;

  const heading = isShipped
    ? `Solicitud ${request.folio} enviada`
    : `Solicitud ${request.folio} lista para pick-up`;
  const lead = isShipped
    ? `El pedido ya fue despachado.`
    : `El pedido ya está listo para que el destinatario lo recoja.`;

  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#2D3277;">${escapeHtml(heading)}</h2>
    <p style="margin:0 0 16px;color:#6b7280;">${lead}</p>
    ${request.receiverName ? `<p style="margin:0 0 12px;"><strong>Destinatario:</strong> ${escapeHtml(request.receiverName)}</p>` : ""}
    ${isShipped && trackingUrl ? `
      <p style="margin:16px 0;">
        <strong>Guía Paquete Express:</strong> ${escapeHtml(request.trackingNumber!)}<br/>
        <a href="${trackingUrl}" style="display:inline-block;margin-top:8px;background:#FFE600;color:#2D3277;font-weight:600;padding:10px 16px;border-radius:8px;text-decoration:none;">Rastrear envío</a>
      </p>
    ` : ""}
    <p style="margin:16px 0 8px;font-weight:600;">Items:</p>
    ${itemsListHtml(request.items)}
  `);

  const text = `${heading}
${lead}
${request.receiverName ? `Destinatario: ${request.receiverName}\n` : ""}${isShipped && trackingUrl ? `Guía: ${request.trackingNumber}\nRastreo: ${trackingUrl}\n` : ""}
Items:
${itemsListText(request.items)}`;

  return sendEmail({
    to,
    subject: isShipped
      ? `[Inventario MP] ${request.folio} enviado · guía ${request.trackingNumber}`
      : `[Inventario MP] ${request.folio} listo para pick-up`,
    html,
    text,
  });
}

export const __test = { sendEmail };
