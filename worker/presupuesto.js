/* ==========================================================================
   Calculadora de presupuesto y zona privada de presupuestos.

   Rutas:
     /calculadora-presupuesto   Calculadora pública (config en presupuesto/config.json)
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

export const PRESUPUESTO_PATHS = ["/calculadora-presupuesto", "/api/calculadora", "/acceso", "/salir", "/presupuestos", "/presupuesto", "/api/presupuestos"];

export async function handlePresupuesto(request, env, ctx, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  switch (path) {
    case "/calculadora-presupuesto":
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

    let payload = null;
    try {
      const b64 = String(form.get("payload_json") || "");
      if (b64) payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    } catch (err) {
      console.error("payload_json no válido", err);
    }

    const T = config.textos || {};
    const fecha = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

    const okAdmin = await sendEmail(env, {
      to: [env.MAIL_TO],
      reply_to: d.email,
      subject: `${T.email_admin_asunto || "Nueva solicitud de presupuesto domótica"} · ${d.nombre}`,
      html: adminCalcHtml(d, fecha),
      text: `Nueva solicitud desde la calculadora (${fecha})\n\nNombre: ${d.nombre}\nTeléfono: ${d.telefono}\nEmail: ${d.email}\nLocalidad: ${d.localidad}\nOrigen: ${d.origen || "-"}\nEstimación: ${d.total}\n\nComentarios:\n${d.comentarios || "-"}\n\n${d.resumen}`,
    });
    if (!okAdmin) return json({ success: false, error: "No se ha podido enviar la solicitud." }, 502);

    // Confirmación al cliente (si falla, la solicitud ya está recibida)
    ctx.waitUntil(
      sendEmail(env, {
        to: [d.email],
        reply_to: env.MAIL_TO,
        subject: T.email_cliente_asunto || "Hemos recibido tu solicitud de presupuesto — Domótica Hogar Madrid",
        html: clienteCalcHtml(d, T, site),
        text: `Hola ${d.nombre},\n\n${T.email_cliente_cuerpo || ""}\n\nEstimación orientativa: ${d.total}\n\nDomótica Hogar Madrid · +34 649 611 494 · domoticahogarmadrid.com`,
      })
    );

    if (env.N8N_CALCULADORA_URL) {
      ctx.waitUntil(
        fetch(env.N8N_CALCULADORA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Secret": env.N8N_CALCULADORA_SECRET || "" },
          body: JSON.stringify({ ...d, payload, fecha: new Date().toISOString(), origen_web: "calculadora-presupuesto" }),
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

function adminCalcHtml(d, fecha) {
  const row = (k, v) => `<tr><td style="padding:9px 14px;color:#5a6a80;font-size:13px;width:140px;border-bottom:1px solid #e6ecf3">${k}</td><td style="padding:9px 14px;color:#0f1a2b;font-size:15px;border-bottom:1px solid #e6ecf3">${v}</td></tr>`;
  const tel = d.telefono.replace(/[^\d+]/g, "");
  const wa = tel.replace(/^\+/, "").replace(/^(\d{9})$/, "34$1");
  return wrap(`
  <tr><td style="background:#0b1220;padding:22px 24px;color:#fff">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8ec0ff">Calculadora de presupuesto</div>
    <div style="font-size:22px;font-weight:700;margin-top:6px">${esc(d.nombre)}</div>
    <div style="font-size:13px;color:#9fb0c6;margin-top:4px">${esc(fecha)}</div>
  </td></tr>
  <tr><td style="padding:18px 24px 4px"><div style="background:#eef5ff;border-radius:12px;padding:14px 16px"><div style="font-size:12px;color:#1f6fe5;text-transform:uppercase;letter-spacing:1px">Estimación</div><div style="font-size:24px;font-weight:700;color:#0f1a2b;margin-top:4px">${esc(d.total)}</div></div></td></tr>
  <tr><td style="padding:10px 10px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row("Teléfono", `<a href="tel:${esc(tel)}" style="color:#1f6fe5">${esc(d.telefono)}</a>`)}
    ${row("Email", `<a href="mailto:${esc(d.email)}" style="color:#1f6fe5">${esc(d.email)}</a>`)}
    ${row("Localidad", esc(d.localidad) || "-")}
    ${row("Origen", esc(d.origen) || "-")}
  </table></td></tr>
  ${d.comentarios ? `<tr><td style="padding:12px 24px 0;font-size:15px;line-height:1.6;white-space:pre-wrap;color:#0f1a2b"><strong>Comentarios:</strong><br>${esc(d.comentarios)}</td></tr>` : ""}
  <tr><td style="padding:16px 24px 0"><pre style="margin:0;white-space:pre-wrap;font:13px/1.55 Consolas,Menlo,monospace;background:#f2f5f9;border-radius:12px;padding:14px;color:#26344a">${esc(d.resumen)}</pre></td></tr>
  <tr><td style="padding:20px 24px 26px">
    <a href="tel:${esc(tel)}" style="display:inline-block;background:#3d8bff;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin-right:8px">Llamar</a>
    <a href="https://wa.me/${esc(wa)}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">WhatsApp</a>
  </td></tr>`);
}

function clienteCalcHtml(d, T, site) {
  const wa = (config.contacto || {}).whatsapp || "34649611494";
  return wrap(`
  <tr><td style="background:#0b1220;padding:26px 24px;text-align:center">
    <img src="${site}/assets/img/logo-full.png" alt="Domótica Hogar Madrid" width="150" style="display:inline-block;width:150px;height:auto">
  </td></tr>
  <tr><td style="padding:26px 26px 6px;color:#0f1a2b">
    <div style="font-size:21px;font-weight:700;margin-bottom:12px">Hola ${esc(d.nombre)},</div>
    <div style="font-size:15px;line-height:1.65;color:#26344a">${esc(T.email_cliente_cuerpo || "Hemos recibido tu solicitud. Te contactaremos en breve.")}</div>
  </td></tr>
  <tr><td style="padding:16px 26px 4px"><div style="background:#eef5ff;border-radius:12px;padding:16px 18px"><div style="font-size:12px;color:#1f6fe5;text-transform:uppercase;letter-spacing:1px">Tu estimación orientativa</div><div style="font-size:24px;font-weight:700;color:#0f1a2b;margin-top:4px">${esc(d.total)}</div><div style="font-size:13px;color:#5a6a80;margin-top:6px">Precio orientativo. La propuesta final se ajusta tras revisar tu vivienda.</div></div></td></tr>
  <tr><td style="padding:22px 26px 28px">
    <a href="https://wa.me/${esc(wa)}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">Escríbenos por WhatsApp</a>
    <a href="${site}/proyectos" style="display:inline-block;background:#3d8bff;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;margin:0 0 8px">Ver instalaciones reales</a>
  </td></tr>
  <tr><td style="padding:16px 26px;background:#f2f5f9;color:#5a6a80;font-size:12px;line-height:1.6">Domótica Hogar Madrid · +34 649 611 494 · info@domoticahogarmadrid.com<br>Recibes este correo porque has solicitado un presupuesto en nuestra web. Más información en nuestra política de privacidad.</td></tr>`);
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
