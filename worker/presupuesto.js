/* ==========================================================================
   Calculadora de presupuesto y zona privada de presupuestos.

   Rutas:
     /calculadora-de-presupuesto Calculadora pública (config en presupuesto/config.json)
     /api/calculadora           Envío de la calculadora: correos + webhook de n8n
     /acceso, /salir            Entrar / salir de la zona privada (clave PASS_PRESUPUESTO)
     /presupuestos              Listado de presupuestos (privado)
     /presupuesto?id=P-0056     Editor de presupuestos (privado)
     /api/presupuestos?action=  Puente privado hacia n8n (datos, guardar, lista)

   Secretos (Workers & Pages → baseweb → Settings → Variables and Secrets):
     PASS_PRESUPUESTO            Clave de la zona privada
     N8N_CALCULADORA_URL         Webhook de n8n que recibe cada solicitud de la calculadora
     N8N_CALCULADORA_SECRET      Clave que se envía a ese webhook (cabecera X-Webhook-Secret)
     N8N_PRESUPUESTO_DATOS_URL   Webhook que devuelve catálogo + presupuesto (?id=)
     N8N_PRESUPUESTO_GUARDAR_URL Webhook que guarda un presupuesto (POST JSON)
     N8N_PRESUPUESTOS_LISTA_URL  Webhook que devuelve la lista de presupuestos
     N8N_PRESUPUESTO_API_KEY     Clave que se envía a esos tres webhooks (cabecera X-Api-Key)
   ========================================================================== */

import calculadoraHtml from "./presupuesto/calculadora.html";
import editorHtml from "./presupuesto/editor.html";
import listadoHtml from "./presupuesto/listado.html";
import accesoHtml from "./presupuesto/acceso.html";
import config from "./presupuesto/config.json";
import { verifyTurnstile, sendEmail, clean, esc, json } from "./lib.js";

const COOKIE = "dhm_presupuestos";
const SESSION_DAYS = 180;
const PRIVATE_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "same-origin" };

export const PRESUPUESTO_PATHS = ["/calculadora-de-presupuesto", "/calculadora-presupuesto", "/api/calculadora", "/acceso", "/salir", "/presupuestos", "/presupuesto", "/api/presupuestos"];

export async function handlePresupuesto(request, env, ctx, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  switch (path) {
    case "/calculadora-presupuesto":
      return new Response(null, { status: 301, headers: { Location: "/calculadora-de-presupuesto" + url.search } });
    case "/calculadora-de-presupuesto":
      return html(injectBeforeHead(calculadoraHtml, calculadoraScript()), { "Cache-Control": "no-cache" });
    case "/api/calculadora":
      if (request.method !== "POST") return json({ success: false, error: "Método no permitido." }, 405);
      return handleCalculadora(request, env, ctx);
    case "/acceso":
      return handleAcceso(request, env, url);
    case "/salir":
      return new Response(null, { status: 302, headers: { Location: "/acceso", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, ...PRIVATE_HEADERS } });
  }

  // Todo lo demás es privado
  const authed = await isAuthed(request, env);
  if (path === "/api/presupuestos") {
    if (!authed) return json({ success: false, error: "Sesión caducada. Vuelve a entrar." }, 401, PRIVATE_HEADERS);
    return handleApiPresupuestos(request, env, url);
  }
  if (!authed) return redirect(`/acceso?volver=${encodeURIComponent(path + url.search)}`);
  if (path === "/presupuestos") return html(listadoHtml, PRIVATE_HEADERS);
  if (path === "/presupuesto") {
    const id = (url.searchParams.get("id") || "").slice(0, 60);
    const bridge = `<script>window.PRESUPUESTO_AJAX_URL="/api/presupuestos";window.PRESUPUESTO_NONCE="sesion";window.PRESUPUESTO_ID=${safeJson(id)};</script>`;
    return html(injectBeforeHead(editorHtml, bridge), PRIVATE_HEADERS);
  }
  return null;
}

/* ---------- Calculadora ---------- */

function calculadoraScript() {
  const P = {};
  for (const [section, values] of Object.entries(config)) {
    if (["contacto", "textos", "camaras", "imagenes"].includes(section) || !values || typeof values !== "object") continue;
    for (const [k, v] of Object.entries(values)) if (typeof v === "number") P[k] = v;
  }
  const imagenes = Object.fromEntries(Object.entries(config.imagenes || {}).filter(([k, v]) => !k.startsWith("_") && v));
  return `<script>
window.domoticaAjaxUrl="/api/calculadora";
window.domoticaNonce="web";
window.P=${safeJson(P)};
window.CAM_CONFIG=${safeJson(config.camaras || {})};
window.TEXTOS=${safeJson(config.textos || {})};
window.WA_NUMBER=${safeJson((config.contacto || {}).whatsapp || "")};
window.IMAGENES=${safeJson(imagenes)};
window.DOMOTICA_IMG="/assets/img/";
</script>`;
}

async function handleCalculadora(request, env, ctx) {
  const site = new URL(request.url).origin;
  try {
    const form = await request.formData();
    const d = {
      nombre: clean(form.get("nombre"), 120),
      email: clean(form.get("email"), 160),
      telefono: clean(form.get("telefono"), 40),
      localidad: clean(form.get("localidad"), 120),
      origen: clean(form.get("origen"), 200),
      comentarios: clean(form.get("comentarios"), 4000, true),
      total: clean(form.get("total"), 80),
      resumen: clean(form.get("resumen"), 20000, true),
    };
    if (!d.nombre || !d.telefono || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      return json({ success: false, error: "Faltan datos de contacto." }, 400);
    }
    const human = await verifyTurnstile(env, form.get("cf-turnstile-response"), request.headers.get("CF-Connecting-IP"));
    if (!human) return json({ success: false, error: "No se ha podido verificar que no eres un robot." }, 400);

    const payload = decodeB64Json(form.get("payload_json"), null);
    const detalle = cleanDetalle(decodeB64Json(form.get("detalle_json"), []));
    d.cuando = TIMING[payload?.contacto?.timing] || "";

    const T = config.textos || {};
    const fecha = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

    const okAdmin = await sendEmail(env, {
      to: [env.MAIL_TO],
      reply_to: d.email,
      subject: `${T.email_admin_asunto || "Nueva solicitud de presupuesto domótica"} — ${d.nombre} · ${d.total}`,
      html: adminCalcHtml(d, detalle, fecha),
      text: `Nueva solicitud desde la calculadora (${fecha})\n\nNombre: ${d.nombre}\nTeléfono: ${d.telefono}\nEmail: ${d.email}\nLocalidad: ${d.localidad}\nCuándo: ${d.cuando || "-"}\nOrigen: ${d.origen || "-"}\nEstimación: ${d.total}\n\nComentarios:\n${d.comentarios || "-"}\n\n${detalleText(detalle) || d.resumen}`,
    });
    if (!okAdmin) return json({ success: false, error: "No se ha podido enviar la solicitud." }, 502);

    // Confirmación al cliente (si falla, la solicitud ya está recibida)
    ctx.waitUntil(
      sendEmail(env, {
        to: [d.email],
        reply_to: env.MAIL_TO,
        subject: T.email_cliente_asunto || "Hemos recibido tu solicitud de presupuesto — Domótica Hogar Madrid",
        html: clienteCalcHtml(d, detalle, T, site),
        text: `Hola ${d.nombre},\n\n${T.email_cliente_cuerpo || ""}\n\nEstimación orientativa: ${d.total} (IVA no incluido)\n\n${detalleText(detalle)}\n\nDomótica Hogar Madrid · +34 649 611 494 · domoticahogarmadrid.com`,
      })
    );

    if (env.N8N_CALCULADORA_URL) {
      ctx.waitUntil(
        fetch(env.N8N_CALCULADORA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Secret": env.N8N_CALCULADORA_SECRET || "" },
          body: JSON.stringify({ ...d, payload, detalle, fecha: new Date().toISOString(), origen_web: "calculadora-de-presupuesto" }),
        })
          .then((r) => { if (!r.ok) console.error("Webhook calculadora respondió", r.status); })
          .catch((err) => console.error("Webhook calculadora fallido", err))
      );
    }
    return json({ success: true });
  } catch (err) {
    console.error("Error en /api/calculadora", err);
    return json({ success: false, error: "No se ha podido enviar la solicitud." }, 500);
  }
}

/* ---------- Zona privada ---------- */

async function handleAcceso(request, env, url) {
  if (!env.PASS_PRESUPUESTO) return html(accesoPage("/presupuestos", "Falta configurar PASS_PRESUPUESTO en Cloudflare."), PRIVATE_HEADERS, 500);
  if (request.method === "POST") {
    const form = await request.formData();
    const volver = safeReturn(form.get("volver"));
    if (await timingSafeEqual(String(form.get("clave") || ""), env.PASS_PRESUPUESTO)) {
      const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
      const token = `${exp}.${await sign(env.PASS_PRESUPUESTO, String(exp))}`;
      return new Response(null, {
        status: 303,
        headers: { Location: volver, "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`, ...PRIVATE_HEADERS },
      });
    }
    await new Promise((r) => setTimeout(r, 800)); // frena los intentos repetidos
    return html(accesoPage(volver, "Clave incorrecta."), PRIVATE_HEADERS, 401);
  }
  const volver = safeReturn(url.searchParams.get("volver"));
  if (await isAuthed(request, env)) return redirect(volver);
  return html(accesoPage(volver, ""), PRIVATE_HEADERS);
}

async function handleApiPresupuestos(request, env, url) {
  const action = url.searchParams.get("action");
  const headers = { "X-Api-Key": env.N8N_PRESUPUESTO_API_KEY || "" };
  let target, init;
  if (action === "presupuesto_datos" && request.method === "GET") {
    if (!env.N8N_PRESUPUESTO_DATOS_URL) return json({ success: false, error: "Falta N8N_PRESUPUESTO_DATOS_URL" }, 500, PRIVATE_HEADERS);
    target = new URL(env.N8N_PRESUPUESTO_DATOS_URL);
    target.searchParams.set("id", url.searchParams.get("id") || "");
    init = { headers };
  } else if (action === "presupuestos_lista" && request.method === "GET") {
    if (!env.N8N_PRESUPUESTOS_LISTA_URL) return json({ success: false, error: "Falta N8N_PRESUPUESTOS_LISTA_URL" }, 500, PRIVATE_HEADERS);
    target = env.N8N_PRESUPUESTOS_LISTA_URL;
    init = { headers };
  } else if (action === "presupuesto_guardar" && request.method === "POST") {
    if (!env.N8N_PRESUPUESTO_GUARDAR_URL) return json({ success: false, error: "Falta N8N_PRESUPUESTO_GUARDAR_URL" }, 500, PRIVATE_HEADERS);
    target = env.N8N_PRESUPUESTO_GUARDAR_URL;
    init = { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: await request.text() };
  } else {
    return json({ success: false, error: "Acción no válida." }, 400, PRIVATE_HEADERS);
  }
  try {
    const res = await fetch(target, init);
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json; charset=utf-8", ...PRIVATE_HEADERS } });
  } catch (err) {
    console.error("n8n no responde", action, err);
    return json({ success: false, error: "n8n no responde." }, 502, PRIVATE_HEADERS);
  }
}

async function isAuthed(request, env) {
  if (!env.PASS_PRESUPUESTO) return false;
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return timingSafeEqual(sig, await sign(env.PASS_PRESUPUESTO, exp));
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function safeReturn(v) {
  const s = String(v || "");
  return /^\/(presupuestos|presupuesto)(\?[^\s]*)?$/.test(s) ? s : "/presupuestos";
}

function accesoPage(volver, error) {
  return accesoHtml.replace("{{VOLVER}}", () => esc(volver)).replace("{{ERROR}}", () => (error ? `<p class="err" role="alert">${esc(error)}</p>` : ""));
}

/* ---------- Correos de la calculadora ---------- */

const TIMING = { urgente: "Lo antes posible", semanas: "En las próximas semanas", meses: "En 1-3 meses", despues: "Más adelante", info: "Solo se está informando" };

function decodeB64Json(value, fallback) {
  try {
    const b64 = String(value || "");
    return b64 ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))) : fallback;
  } catch (err) {
    console.error("JSON en base64 no válido", err);
    return fallback;
  }
}

// Desglose de la pantalla de resumen de la calculadora: [{icon, title, rows:[{t, name, detail, price, val}]}]
function cleanDetalle(raw) {
  if (!Array.isArray(raw)) return [];
  const txt = (v, n = 300) => String(v ?? "").replace(/<[^>]*>/g, "").trim().slice(0, n);
  return raw.slice(0, 20).map((sec) => ({
    icon: txt(sec?.icon, 8),
    title: txt(sec?.title, 80),
    rows: (Array.isArray(sec?.rows) ? sec.rows : []).slice(0, 40).map((r) => ({
      t: ["price", "info", "nls"].includes(r?.t) ? r.t : "info",
      name: txt(r?.name),
      detail: txt(r?.detail),
      price: txt(r?.price, 40),
      val: txt(r?.val, 2000),
    })),
  })).filter((sec) => sec.rows.length);
}

function detalleText(detalle) {
  return detalle.map((sec) => [`== ${sec.title.toUpperCase()} ==`, ...sec.rows.map((r) =>
    r.t === "price" ? `- ${r.name}${r.detail ? ` (${r.detail})` : ""}: ${r.price}` : r.t === "nls" ? `! ${r.name}` : `- ${r.name ? r.name + ": " : ""}${r.val}`)].join("\n")).join("\n\n");
}

function detalleHtml(detalle) {
  return detalle.map((sec) => `
  <tr><td style="padding:14px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e9f1;border-radius:12px;border-collapse:separate;overflow:hidden">
      <tr><td colspan="2" style="background:#f4f7fb;padding:11px 16px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#26344a;border-bottom:1px solid #e3e9f1">${sec.icon ? esc(sec.icon) + "&nbsp; " : ""}${esc(sec.title)}</td></tr>
      ${sec.rows.map((r, i) => {
        const line = i < sec.rows.length - 1 ? "border-bottom:1px solid #eef2f7;" : "";
        if (r.t === "price") return `<tr><td style="padding:11px 16px;${line}"><div style="font-size:14px;font-weight:600;color:#0f1a2b">${esc(r.name)}</div>${r.detail ? `<div style="font-size:12px;color:#7a8799;margin-top:3px">${esc(r.detail)}</div>` : ""}</td><td align="right" style="padding:11px 16px;${line}font-size:14px;font-weight:700;color:#1f6fe5;white-space:nowrap">${esc(r.price)}</td></tr>`;
        if (r.t === "nls") return `<tr><td colspan="2" style="padding:11px 16px;${line}font-size:13px;color:#9a3412;background:#fff7ed">⚠️ ${esc(r.name)}</td></tr>`;
        if (!r.name) return `<tr><td colspan="2" style="padding:11px 16px;${line}font-size:14px;color:#0f1a2b;white-space:pre-wrap">${esc(r.val)}</td></tr>`;
        return `<tr><td style="padding:10px 16px;${line}font-size:13px;color:#5a6a80;vertical-align:top">${esc(r.name)}</td><td align="right" style="padding:10px 16px;${line}font-size:13px;color:#0f1a2b;white-space:pre-wrap">${esc(r.val)}</td></tr>`;
      }).join("")}
    </table>
  </td></tr>`).join("");
}

function totalHtml(d, label) {
  return `<tr><td style="background:linear-gradient(135deg,#3d8bff,#1f5fd0);background-color:#2a6fe0;padding:26px 24px;text-align:center;color:#fff">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#dbe8ff">${label}</div>
    <div style="font-size:32px;font-weight:800;margin-top:8px;letter-spacing:-0.5px">${esc(d.total)}</div>
    <div style="font-size:12px;color:#dbe8ff;margin-top:6px">Precio orientativo · IVA no incluido</div>
  </td></tr>`;
}

function adminCalcHtml(d, detalle, fecha) {
  const row = (k, v) => `<tr><td style="padding:10px 16px;color:#5a6a80;font-size:13px;width:130px;border-bottom:1px solid #eef2f7">${k}</td><td style="padding:10px 16px;color:#0f1a2b;font-size:14px;font-weight:600;border-bottom:1px solid #eef2f7">${v}</td></tr>`;
  const tel = d.telefono.replace(/[^\d+]/g, "");
  const wa = tel.replace(/^\+/, "").replace(/^(\d{9})$/, "34$1");
  return wrap(`
  <tr><td style="background:#0b1220;padding:20px 24px;color:#fff">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8ec0ff">Nueva solicitud · Calculadora</div>
    <div style="font-size:21px;font-weight:700;margin-top:6px">${esc(d.nombre)}</div>
    <div style="font-size:13px;color:#9fb0c6;margin-top:4px">${esc(fecha)}</div>
  </td></tr>
  ${totalHtml(d, "Presupuesto domótica")}
  <tr><td style="padding:20px 24px 0">
    <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#26344a;margin-bottom:8px">Datos de contacto</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e9f1;border-radius:12px;border-collapse:separate">
      ${row("Nombre", esc(d.nombre))}
      ${row("Email", `<a href="mailto:${esc(d.email)}" style="color:#1f6fe5">${esc(d.email)}</a>`)}
      ${row("Teléfono", `<a href="tel:${esc(tel)}" style="color:#1f6fe5">${esc(d.telefono)}</a>`)}
      ${row("Localidad", esc(d.localidad) || "-")}
      ${d.cuando ? row("Cuándo", esc(d.cuando)) : ""}
      ${d.origen ? row("Origen", esc(d.origen)) : ""}
      ${row("Fecha", esc(fecha))}
      ${d.comentarios ? row("Comentarios", `<span style="font-weight:400;white-space:pre-wrap">${esc(d.comentarios)}</span>`) : ""}
    </table>
  </td></tr>
  ${detalleHtml(detalle.filter((sec) => sec.title !== "Comentarios"))}
  ${detalle.length ? "" : `<tr><td style="padding:16px 24px 0"><pre style="margin:0;white-space:pre-wrap;font:13px/1.55 Consolas,Menlo,monospace;background:#f2f5f9;border-radius:12px;padding:14px;color:#26344a">${esc(d.resumen)}</pre></td></tr>`}
  <tr><td style="padding:22px 24px 26px">
    <a href="tel:${esc(tel)}" style="display:inline-block;background:#3d8bff;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">Llamar</a>
    <a href="https://wa.me/${esc(wa)}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">WhatsApp</a>
    <a href="mailto:${esc(d.email)}" style="display:inline-block;background:#0f1a2b;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin:0 0 8px">Responder por email</a>
  </td></tr>`);
}

function clienteCalcHtml(d, detalle, T, site) {
  const wa = (config.contacto || {}).whatsapp || "34649611494";
  return wrap(`
  <tr><td style="background:#0b1220;padding:26px 24px;text-align:center">
    <img src="${site}/assets/img/logo-full.png" alt="Domótica Hogar Madrid" width="150" style="display:inline-block;width:150px;height:auto">
  </td></tr>
  <tr><td style="padding:26px 26px 18px;color:#0f1a2b">
    <div style="font-size:21px;font-weight:700;margin-bottom:12px">Hola ${esc(d.nombre)},</div>
    <div style="font-size:15px;line-height:1.65;color:#26344a">${esc(T.email_cliente_cuerpo || "Hemos recibido tu solicitud. Te contactaremos en breve.")}</div>
  </td></tr>
  ${totalHtml(d, "Tu estimación orientativa")}
  <tr><td style="padding:20px 24px 0"><div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#26344a">Resumen de tu configuración</div></td></tr>
  ${detalleHtml(detalle)}
  <tr><td style="padding:16px 26px 0;font-size:13px;line-height:1.6;color:#5a6a80">La propuesta final se ajusta tras revisar tu vivienda con un técnico. Si quieres cambiar algo, responde a este correo o escríbenos por WhatsApp.</td></tr>
  <tr><td style="padding:20px 26px 28px">
    <a href="https://wa.me/${esc(wa)}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">Escríbenos por WhatsApp</a>
    <a href="${site}/proyectos" style="display:inline-block;background:#3d8bff;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin:0 0 8px">Ver instalaciones reales</a>
  </td></tr>
  <tr><td style="padding:16px 26px;background:#f2f5f9;color:#5a6a80;font-size:12px;line-height:1.6">Domótica Hogar Madrid · +34 649 611 494 · info@domoticahogarmadrid.com<br>Recibes este correo porque has solicitado un presupuesto en nuestra web. Más información en nuestra <a href="${site}/privacidad" style="color:#5a6a80">política de privacidad</a>.</td></tr>`);
}

function wrap(rows) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f2f5f9;font-family:Inter,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border-radius:16px;overflow:hidden">${rows}</table>
</td></tr></table></body></html>`;
}

function html(body, headers = {}, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, ...PRIVATE_HEADERS } });
}

function injectBeforeHead(page, snippet) {
  return page.replace(/<\/head>/i, () => `${snippet}\n</head>`);
}

function safeJson(v) {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}
