/* ==========================================================================
   Domótica Hogar Madrid — Worker
   Sirve la web estática y recibe el formulario de contacto en /api/contacto.

   Secretos (Workers & Pages → baseweb → Settings → Variables and Secrets):
     RESEND_API_KEY    Clave de Resend con permiso de envío
     TURNSTILE_SECRET  Secret Key del widget de Turnstile
     MAIL_TO           Dirección que recibe los avisos de nuevas solicitudes
     WEBHOOK_URL       (opcional) URL que recibe cada solicitud en JSON
   ========================================================================== */

const MAIL_FROM = "Domótica Hogar Madrid <info@domoticahogarmadrid.com>";
const LIMITS = { nombre: 120, telefono: 40, email: 160, municipio: 120, tipo: 120, interes: 400, mensaje: 4000 };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contacto") {
      if (request.method !== "POST") return json({ ok: false, error: "Método no permitido." }, 405);
      try {
        return await handleContact(request, env, ctx);
      } catch (err) {
        console.error("Error en /api/contacto", err);
        return json({ ok: false, error: "No hemos podido enviar tu solicitud." }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env, ctx) {
  const form = await request.formData();

  // Campo trampa: solo lo rellenan los robots. Respondemos "ok" sin enviar nada.
  if (form.get("web")) return json({ ok: true });

  const data = {
    nombre: clean(form.get("nombre"), LIMITS.nombre),
    telefono: clean(form.get("telefono"), LIMITS.telefono),
    email: clean(form.get("email"), LIMITS.email),
    municipio: clean(form.get("municipio"), LIMITS.municipio),
    tipo: clean(form.get("tipo"), LIMITS.tipo),
    intereses: clean(form.getAll("interes").join(", "), LIMITS.interes),
    mensaje: clean(form.get("mensaje"), LIMITS.mensaje, true),
    pagina: clean(form.get("pagina"), 200),
  };

  if (!data.nombre || !data.telefono) return json({ ok: false, error: "Indica tu nombre y tu teléfono." }, 400);
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return json({ ok: false, error: "El email no parece válido." }, 400);
  if (form.get("acepto") !== "si") return json({ ok: false, error: "Debes aceptar la política de privacidad." }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const human = await verifyTurnstile(env, form.get("cf-turnstile-response"), ip);
  if (!human) return json({ ok: false, error: "No hemos podido verificar que no eres un robot. Recarga la página e inténtalo de nuevo." }, 400);

  const fecha = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

  const sent = await sendEmail(env, {
    to: [env.MAIL_TO],
    reply_to: data.email || undefined,
    subject: `Nueva solicitud web: ${data.nombre}${data.municipio ? ` (${data.municipio})` : ""}`,
    html: noticeHtml(data, fecha),
    text: noticeText(data, fecha),
  });
  if (!sent) return json({ ok: false, error: "No hemos podido enviar tu solicitud." }, 502);

  if (env.WEBHOOK_URL) {
    ctx.waitUntil(
      fetch(env.WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen: "formulario-contacto", fecha: new Date().toISOString(), ...data }),
      }).catch((err) => console.error("Webhook fallido", err))
    );
  }

  return json({ ok: true });
}

async function verifyTurnstile(env, token, ip) {
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

async function sendEmail(env, msg) {
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

/* ---------- Plantillas ---------- */

function noticeText(d, fecha) {
  return [
    `Nueva solicitud desde la web (${fecha})`,
    "",
    `Nombre: ${d.nombre}`,
    `Teléfono: ${d.telefono}`,
    `Email: ${d.email || "-"}`,
    `Municipio: ${d.municipio || "-"}`,
    `Tipo de proyecto: ${d.tipo || "-"}`,
    `Le interesa: ${d.intereses || "-"}`,
    "",
    d.mensaje || "(Sin mensaje)",
  ].join("\n");
}

function noticeHtml(d, fecha) {
  const row = (k, v) =>
    `<tr><td style="padding:10px 14px;color:#5a6a80;font-size:13px;width:150px;border-bottom:1px solid #e6ecf3">${k}</td><td style="padding:10px 14px;color:#0f1a2b;font-size:15px;border-bottom:1px solid #e6ecf3">${v}</td></tr>`;
  const tel = d.telefono.replace(/[^\d+]/g, "");
  const wa = tel.replace(/^\+/, "").replace(/^(?!34)(\d{9})$/, "34$1");
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f2f5f9;font-family:Inter,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="background:#0b1220;padding:22px 24px;color:#ffffff">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8ec0ff">Nueva solicitud web</div>
    <div style="font-size:22px;font-weight:700;margin-top:6px">${esc(d.nombre)}</div>
    <div style="font-size:13px;color:#9fb0c6;margin-top:4px">${esc(fecha)}</div>
  </td></tr>
  <tr><td style="padding:18px 10px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("Teléfono", `<a href="tel:${esc(tel)}" style="color:#1f6fe5">${esc(d.telefono)}</a>`)}
      ${row("Email", d.email ? `<a href="mailto:${esc(d.email)}" style="color:#1f6fe5">${esc(d.email)}</a>` : "-")}
      ${row("Municipio", esc(d.municipio) || "-")}
      ${row("Tipo de proyecto", esc(d.tipo) || "-")}
      ${row("Le interesa", esc(d.intereses) || "-")}
    </table>
  </td></tr>
  <tr><td style="padding:12px 24px 4px;color:#0f1a2b;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(d.mensaje) || "<em style='color:#5a6a80'>Sin mensaje</em>"}</td></tr>
  <tr><td style="padding:20px 24px 26px">
    <a href="tel:${esc(tel)}" style="display:inline-block;background:#3d8bff;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin-right:8px">Llamar</a>
    <a href="https://wa.me/${esc(wa)}" style="display:inline-block;background:#25d366;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">WhatsApp</a>
  </td></tr>
  <tr><td style="padding:14px 24px;background:#f2f5f9;color:#5a6a80;font-size:12px">Enviado desde ${esc(d.pagina) || "la web"} · domoticahogarmadrid.com</td></tr>
</table></td></tr></table></body></html>`;
}

/* ---------- Utilidades ---------- */

function clean(value, max, multiline = false) {
  let s = typeof value === "string" ? value : "";
  s = multiline ? s.replace(/\r\n?/g, "\n") : s.replace(/[\r\n\t]+/g, " ");
  return s.trim().slice(0, max);
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
