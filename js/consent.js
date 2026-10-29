/* ==========================================================================
   Domótica Hogar Madrid — Aviso de cookies y Google Analytics 4
   Analytics solo se carga si el visitante acepta (LSSI art. 22.2 / guía AEPD).
   Se usa en todas las páginas públicas y en la calculadora.
   ========================================================================== */
(function () {
  const GA_ID = "G-LM4VPEEGYZ"; // ID de medición de Google Analytics 4, p. ej. "G-ABC123XYZ"
  const KEY = "dhm_cookies"; // "aceptadas" | "rechazadas"
  const DAYS = 180;

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "null");
      return v && v.exp > Date.now() ? v.valor : null;
    } catch (e) {
      return null;
    }
  };
  const save = (valor) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ valor, exp: Date.now() + DAYS * 864e5 }));
    } catch (e) {}
  };

  let loaded = false;
  function loadGA() {
    if (loaded || !GA_ID) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }

  function removeGACookies() {
    document.cookie.split(";").map((c) => c.trim().split("=")[0]).filter((n) => /^_ga/.test(n)).forEach((n) => {
      const host = location.hostname.replace(/^www\./, "");
      document.cookie = `${n}=; Max-Age=0; path=/`;
      document.cookie = `${n}=; Max-Age=0; path=/; domain=.${host}`;
    });
  }

  // Eventos de conversión: solo se envían si hay consentimiento
  window.dhmTrack = function (event, params) {
    if (loaded && window.gtag) window.gtag("event", event, params || {});
  };

  const CSS = `
  .dhm-cookies{position:fixed;left:16px;bottom:16px;z-index:9999;max-width:420px;padding:14px 16px;border-radius:16px;
    background:rgba(10,16,28,.92);color:#c9d5e3;border:1px solid rgba(255,255,255,.12);box-shadow:0 20px 40px -20px rgba(0,0,0,.6);
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font:13px/1.5 Inter,"Plus Jakarta Sans",system-ui,sans-serif;
    display:flex;align-items:center;gap:14px;transform:translateY(16px);opacity:0;transition:transform .5s cubic-bezier(.22,1,.36,1),opacity .5s}
  .dhm-cookies.is-in{transform:none;opacity:1}
  .dhm-cookies p{margin:0;flex:1}
  .dhm-cookies a{color:#8ec0ff;white-space:nowrap}
  .dhm-cookies .dhm-row{display:flex;gap:6px;flex:none}
  .dhm-cookies button{font:inherit;font-weight:600;font-size:12.5px;padding:8px 14px;border-radius:999px;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff}
  .dhm-cookies button:hover{background:rgba(255,255,255,.14)}
  .dhm-cookies button:focus-visible{outline:2px solid #8ec0ff;outline-offset:2px}
  @media (max-width:640px){.dhm-cookies{left:10px;right:80px;bottom:10px;max-width:none;flex-direction:column;align-items:stretch;gap:10px}.dhm-cookies .dhm-row button{flex:1}}`;

  function showBanner() {
    if (!GA_ID || document.querySelector(".dhm-cookies")) return;
    if (!document.getElementById("dhm-cookies-css")) {
      const st = document.createElement("style");
      st.id = "dhm-cookies-css";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const box = document.createElement("div");
    box.className = "dhm-cookies";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Aviso de cookies");
    box.innerHTML = `<p>Usamos cookies de Google Analytics para medir las visitas. <a href="/legal#cookies">Más información</a></p>
      <div class="dhm-row"><button type="button" data-dhm="rechazar">Rechazar</button><button type="button" data-dhm="aceptar">Aceptar</button></div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add("is-in"));
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-dhm]");
      if (!b) return;
      if (b.dataset.dhm === "aceptar") {
        save("aceptadas");
        loadGA();
      } else {
        save("rechazadas");
        removeGACookies();
        if (loaded) location.reload(); // descarga Analytics si estaba activo
      }
      box.remove();
    });
  }

  function init() {
    const v = read();
    if (v === "aceptadas") loadGA();
    else if (v === null) showBanner();

    document.addEventListener("click", (e) => {
      // Reabrir el aviso desde «Configurar cookies»
      if (e.target.closest("[data-cookie-settings]")) {
        e.preventDefault();
        showBanner();
        return;
      }
      // Clics de contacto
      const a = e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (/wa\.me\//.test(href)) window.dhmTrack("contacto_whatsapp", { ubicacion: location.pathname });
      else if (/^tel:/.test(href)) window.dhmTrack("contacto_telefono", { ubicacion: location.pathname });
      else if (/^mailto:/.test(href)) window.dhmTrack("contacto_email", { ubicacion: location.pathname });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
