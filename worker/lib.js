const MAIL_FROM = "Domótica Hogar Madrid <info@domoticahogarmadrid.com>";

/* Utilidades compartidas por el formulario de contacto y la calculadora */

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) {
    console.error("Turnstile: falta el secreto TURNSTILE_SECRET en el Worker");
    return false;
  }
  if (!token) {
    console.error("Turnstile: el formulario llegó sin token");
    return false;
  }
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const out = await res.json();
  if (!out.success) console.error("Turnstile rechazado:", JSON.stringify(out["error-codes"] || out));
  return out.success === true;
}

export async function sendEmail(env, msg) {
  if (!env.RESEND_API_KEY || !env.MAIL_TO) {
    console.error("Faltan RESEND_API_KEY o MAIL_TO");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, ...msg }),
  });
  if (!res.ok) console.error("Resend respondió", res.status, await res.text());
  return res.ok;
}

export function clean(value, max, multiline = false) {
  let s = typeof value === "string" ? value : "";
  s = multiline ? s.replace(/\r\n?/g, "\n") : s.replace(/[\r\n\t]+/g, " ");
  return s.trim().slice(0, max);
}

export function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });
}

