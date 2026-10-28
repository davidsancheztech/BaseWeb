#!/usr/bin/env python3
"""Compone las páginas estáticas: cabecera + cuerpo + pie, con iconos SVG inline."""
import re, pathlib, json

SRC = pathlib.Path(__file__).parent / "src"
OUT = pathlib.Path(__file__).resolve().parent.parent
DOMAIN = "https://domoticahogarmadrid.com"
PHONE_DISPLAY = "+34 649 611 494"
PHONE_TEL = "+34649611494"
WA = "34649611494"
EMAIL = "info@domoticahogarmadrid.com"
IG = "domoticahogarmadrid"

S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
ICONS = {
    "arrow": f'<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-left": f'<path d="M19 12H5M11 6l-6 6 6 6"/>',
    "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "pin": '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "bulb": '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    "blinds": '<path d="M4 4h16M5 4v12M19 4v12M5 8h14M5 12h14M5 16h14M12 16v4"/><circle cx="12" cy="20.5" r=".5"/>',
    "thermo": '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
    "shield": '<path d="M12 3 5 6v6c0 4.4 3 7.8 7 9 4-1.2 7-4.6 7-9V6l-7-3z"/><path d="m9 12 2 2 4-4"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    "wifi": '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".8"/>',
    "home": '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    "building": '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
    "chip": '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    "star": 'FILL<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/>',
    "play": 'FILL<path d="M8 5.5v13l11-6.5z"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    "moon": '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    "film": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    "door": '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r=".9"/>',
    "leaf": '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 14 10"/>',
    "cog": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    "mic": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    "camera": '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    "layers": '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    "network": '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="12" cy="13" r="2"/><path d="M12 7v4M10.5 14.5 6.5 17.5M13.5 14.5l4 3"/>',
    "plug": '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
    "tools": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    "chat": '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 4.8"/>',
    "sliders": '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "hotel": '<path d="M3 21V7l9-4 9 4v14M3 21h18"/><path d="M9 21v-5h6v5M8 9h1M11.5 9h1M15 9h1M8 12.5h1M11.5 12.5h1M15 12.5h1"/>',
    "store": '<path d="M4 9.5V20h16V9.5M3 4h18l-1.5 5a3 3 0 0 1-5.6.4A3 3 0 0 1 12 11a3 3 0 0 1-2.9-1.6A3 3 0 0 1 3.5 9z"/><path d="M10 20v-5h4v5"/>',
    "drop": '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    "phone-app": '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    "euro": '<path d="M17.5 6.5A7 7 0 1 0 17.5 17.5M4 10h9M4 14h9"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "whatsapp": 'FILL<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/>',
    "instagram": '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".9" fill="currentColor"/>',
    "youtube": '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>',
    "linkedin": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
    "facebook": '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v7h4v-7h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5z"/>',
    "google": 'FILL<path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" opacity=".9"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" opacity=".75"/><path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" opacity=".6"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" opacity=".45"/>',
}


def icon(name, cls=""):
    body = ICONS[name]
    c = f' class="{cls}"' if cls else ""
    if body.startswith("FILL"):
        return f'<svg{c} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{body[4:]}</svg>'
    return f'<svg{c} viewBox="0 0 24 24" {S} aria-hidden="true">{body}</svg>'


LOGO = """<img class="logo__icon" src="assets/img/logo-icon.png" alt="" width="334" height="328"><img class="logo__word" src="assets/img/logo-wordmark.png" alt="Domótica Hogar Madrid" width="945" height="205">"""
LOGO_FULL = """<img class="logo-full" src="assets/img/logo-full.png" alt="Domótica Hogar Madrid · Tu casa inteligente" width="945" height="638" loading="lazy">"""

VIDEOS = {
    "jardin-piscina": ("Jardín", "Jardín y piscina desde el móvil", "Iluminación exterior con un toque"),
    "pergola-led": ("Iluminación", "Pérgola con tira LED regulable", "Escena de exterior al anochecer"),
    "panel-home-assistant": ("Control", "Panel de pared con Home Assistant", "Luces, persianas y clima en una pantalla"),
    "videoportero-panel": ("Accesos", "Videoportero en el panel de casa", "Atiende la llamada y abre desde la pantalla"),
    "videoportero-accesos": ("Accesos", "Videoportero Hikvision con tarjeta", "Apertura por código, tarjeta o móvil"),
    "camaras-seguridad": ("Seguridad", "Instalación de cámaras exteriores", "Vigilancia integrada en Home Assistant"),
    "rack-cuadro": ("Instalación", "Rack de red y cuadro domótico", "Infraestructura ordenada y documentada"),
    "vivienda-recorrido": ("Proyecto", "Recorrido por una vivienda domotizada", "Exterior, accesos e interiores"),
    "exterior-vivienda": ("Exterior", "Exterior de vivienda domotizada", "Fachada, patio y control exterior"),
}


def vcard(slug, extra=""):
    tag, title, sub = VIDEOS[slug]
    v = f"assets/video/{slug}"
    return (f'<figure class="vcard{extra}" data-video="{v}.mp4" data-poster="{v}.jpg" data-title="{title}" tabindex="0" role="button" aria-label="Ver vídeo: {title}">'
            f'<video muted loop playsinline preload="none" poster="{v}.jpg" data-autoplay><source src="{v}.mp4" type="video/mp4"></video>'
            f'<span class="vcard__tag">{tag}</span><span class="vcard__expand">{icon("play")}</span>'
            f'<figcaption><b>{title}</b><small>{sub}</small></figcaption></figure>')


def vframe(slug, cls="vframe"):
    v = f"assets/video/{slug}"
    return f'<div class="{cls}"><video muted loop playsinline autoplay preload="auto" poster="{v}.jpg" data-autoplay><source src="{v}.mp4" type="video/mp4"></video></div>'

NAV = [
    ("index.html", "Inicio"),
    ("domotica-hogar.html", "Hogar"),
    ("interruptores-zigbee.html", "Interruptores"),
    ("empresas-knx-dali.html", "Empresas KNX"),
    ("proyectos.html", "Proyectos"),
    ("contacto.html", "Contacto"),
]


def header(active):
    links = "\n".join(
        f'      <a class="nav__link{" is-active" if h == active else ""}" href="{h}"{" aria-current=\"page\"" if h == active else ""}>{t}</a>'
        for h, t in NAV
    )
    return f"""<a class="skip-link" href="#main">Saltar al contenido</a>
<div class="scroll-progress" aria-hidden="true"></div>
<header class="site-header">
  <div class="container">
    <a class="logo" href="index.html" aria-label="Domótica Hogar Madrid, inicio">{LOGO}</a>
    <nav class="nav" id="nav" aria-label="Principal">
{links}
    </nav>
    <div class="header-cta">
      <a class="header-phone" href="tel:{PHONE_TEL}">{icon("phone")}{PHONE_DISPLAY}</a>
      <a class="btn btn--primary" href="contacto.html">Estudio gratuito {icon("arrow")}</a>
      <button class="nav-toggle" aria-controls="nav" aria-expanded="false" aria-label="Abrir menú"><span></span></button>
    </div>
  </div>
</header>"""


def footer():
    return f"""<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="logo-footer" href="index.html">{LOGO_FULL}</a>
        <p>Integradores de domótica en Madrid: Home Assistant, Zigbee, KNX y DALI. Diseñamos, instalamos y mantenemos hogares y edificios inteligentes.</p>
        <div class="socials">
          <a href="https://www.instagram.com/{IG}/" target="_blank" rel="noopener" aria-label="Instagram">{icon("instagram")}</a>
          <a href="https://wa.me/{WA}" target="_blank" rel="noopener" aria-label="WhatsApp">{icon("whatsapp")}</a>
          <a href="https://www.youtube.com/" target="_blank" rel="noopener" aria-label="YouTube">{icon("youtube")}</a>
          <a href="https://www.linkedin.com/" target="_blank" rel="noopener" aria-label="LinkedIn">{icon("linkedin")}</a>
        </div>
      </div>
      <div>
        <h4>Servicios</h4>
        <ul>
          <li><a href="domotica-hogar.html">Domótica para el hogar</a></li>
          <li><a href="domotica-hogar.html#home-assistant">Home Assistant</a></li>
          <li><a href="interruptores-zigbee.html">Interruptores Zigbee</a></li>
          <li><a href="empresas-knx-dali.html">KNX para empresas</a></li>
          <li><a href="empresas-knx-dali.html#dali">Iluminación DALI</a></li>
        </ul>
      </div>
      <div>
        <h4>Empresa</h4>
        <ul>
          <li><a href="proyectos.html">Proyectos</a></li>
          <li><a href="proyectos.html#testimonios">Opiniones</a></li>
          <li><a href="index.html#faq">Preguntas frecuentes</a></li>
          <li><a href="contacto.html">Contacto</a></li>
          <li><a href="privacidad.html">Política de privacidad</a></li>
        </ul>
      </div>
      <div>
        <h4>Hablemos</h4>
        <ul>
          <li><a href="tel:{PHONE_TEL}">{PHONE_DISPLAY}</a></li>
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li>Madrid capital y Comunidad de Madrid</li>
          <li>L–V 9:00–19:00</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span data-year>2026</span> Domótica Hogar Madrid. Todos los derechos reservados.</span>
      <nav aria-label="Legal"><a href="legal.html">Aviso legal</a><a href="privacidad.html">Política de privacidad</a><a href="legal.html#cookies">Cookies</a></nav>
    </div>
  </div>
</footer>
<div class="lightbox" hidden role="dialog" aria-modal="true" aria-label="Vídeo"><button class="lightbox__close" aria-label="Cerrar vídeo">×</button><div><video controls playsinline></video><p class="lightbox__caption"></p></div></div>
<a class="wa-float" href="https://wa.me/{WA}?text=Hola%2C%20me%20interesa%20domotizar%20mi%20casa" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">{icon("whatsapp")}<span class="wa-float__tip">¿Hablamos por WhatsApp?</span></a>"""


SCHEMA = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "name": "Domótica Hogar Madrid",
    "url": DOMAIN + "/",
    "email": EMAIL,
    "telephone": PHONE_TEL,
    "areaServed": {"@type": "AdministrativeArea", "name": "Comunidad de Madrid"},
    "address": {"@type": "PostalAddress", "addressLocality": "Torrejón de Ardoz", "postalCode": "28850", "addressRegion": "Madrid", "addressCountry": "ES"},
    "sameAs": [f"https://www.instagram.com/{IG}/"],
    "knowsAbout": ["Domótica", "Home Assistant", "Zigbee", "KNX", "DALI", "Shelly", "Aqara", "Airzone", "Legrand Netatmo"],
}


def page(fname, title, desc, body, active=None, schema=False):
    body = re.sub(r"\{\{include:([\w-]+)\}\}", lambda m: (SRC / "_partials" / f"{m.group(1)}.html").read_text(encoding="utf-8"), body)
    body = re.sub(r"\[\[v:([\w-]+)\]\]", lambda m: vcard(m.group(1)), body)
    body = re.sub(r"\[\[vf:([\w-]+)(?:\|([\w -]+))?\]\]", lambda m: vframe(m.group(1), m.group(2) or "vframe"), body)
    body = re.sub(r"\[\[i:([\w-]+)(?:\|([\w -]+))?\]\]", lambda m: icon(m.group(1), m.group(2) or ""), body)
    body = body.replace("{{PHONE_TEL}}", PHONE_TEL).replace("{{PHONE}}", PHONE_DISPLAY).replace("{{WA}}", WA).replace("{{EMAIL}}", EMAIL).replace("{{IG}}", IG)
    canonical = DOMAIN + "/" + ("" if fname == "index.html" else fname)
    ld = f'\n  <script type="application/ld+json">{json.dumps(SCHEMA, ensure_ascii=False)}</script>' if schema else ""
    html = f"""<!doctype html>
<html lang="es" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{canonical}">
  <meta name="theme-color" content="#0a0e13">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="Domótica Hogar Madrid">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{DOMAIN}/assets/img/logo-domotica-hogar-madrid.jpg">
  <link rel="icon" href="assets/img/favicon.png" type="image/png">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">{ld}
</head>
<body>
{header(active)}
<main id="main">
{body.strip()}
</main>
{footer()}
<script src="js/main.js" defer></script>
</body>
</html>
"""
    (OUT / fname).write_text(html, encoding="utf-8")
    print("escrito", fname, len(html))


PAGES = [
    ("index.html", "Domótica en Madrid | Home Assistant, Zigbee y KNX — Domótica Hogar Madrid",
     "Integradores de domótica en Madrid. Casas inteligentes con Home Assistant, Shelly, Aqara, Airzone e interruptores Legrand Netatmo. KNX y DALI para empresas. Estudio gratuito.", "index.html", True),
    ("domotica-hogar.html", "Domótica para el hogar en Madrid | Home Assistant, Shelly, Aqara, Airzone",
     "Convierte tu casa en inteligente sin obras: Home Assistant con Shelly, Sonoff, Aqara y Airzone. Luces, persianas, clima, seguridad y ahorro energético en Madrid.", "domotica-hogar.html", False),
    ("interruptores-zigbee.html", "Interruptores inteligentes Zigbee | Legrand with Netatmo en Madrid",
     "Mecanismos de diseño conectados: Legrand with Netatmo, BTicino y Aqara sobre Zigbee, integrados en Home Assistant. Instalación profesional en Madrid.", "interruptores-zigbee.html", False),
    ("empresas-knx-dali.html", "KNX y DALI para empresas en Madrid | Domótica Hogar Madrid",
     "Automatización profesional para oficinas, hoteles, retail y edificios: KNX, iluminación DALI-2, integración con clima, BMS y control energético.", "empresas-knx-dali.html", False),
    ("proyectos.html", "Proyectos y opiniones | Domótica Hogar Madrid",
     "Proyectos de domótica en Madrid: viviendas con Home Assistant, reformas con mecanismos Zigbee y oficinas con KNX y DALI. Opiniones de clientes y vídeos.", "proyectos.html", False),
    ("contacto.html", "Contacto y estudio gratuito | Domótica Hogar Madrid",
     "Pide tu estudio de domótica gratuito en Madrid. Te respondemos en menos de 24 h por teléfono, WhatsApp o email.", "contacto.html", False),
    ("legal.html", "Aviso legal y cookies | Domótica Hogar Madrid",
     "Aviso legal y política de cookies de Domótica Hogar Madrid.", None, False),
    ("privacidad.html", "Política de privacidad | Domótica Hogar Madrid",
     "Política de privacidad de Domótica Hogar Madrid: qué datos tratamos, para qué, durante cuánto tiempo y cómo ejercer tus derechos o solicitar su eliminación.", None, False),
]

if __name__ == "__main__":
    for fname, title, desc, active, schema in PAGES:
        src = SRC / fname
        if src.exists():
            page(fname, title, desc, src.read_text(encoding="utf-8"), active, schema)
