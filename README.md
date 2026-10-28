# Domótica Hogar Madrid — Web corporativa

Web estática (HTML + CSS + JS, sin dependencias ni build) para **domoticahogarmadrid.com**.
Se puede publicar tal cual en cualquier hosting (Netlify, Vercel, GitHub Pages, cPanel…).

## Páginas

| Archivo | Contenido |
|---|---|
| `index.html` | Portada: hero con vídeos reales, marcas y protocolos, servicios, tira de vídeos de Instagram, escenas interactivas, cifras, proceso, trabajos reales, testimonios, FAQ |
| `domotica-hogar.html` | Home Assistant, qué se automatiza, Shelly / Sonoff / Aqara / Airzone / Legrand / Hikvision / Matter / Z-Wave, protocolos (Wi-Fi, Zigbee, Z-Wave, Thread, Matter sobre Thread y sobre Wi-Fi, KNX), videoportero, panel de pared, ahorro energético y packs |
| `interruptores-zigbee.html` | Mecanismos Legrand with Netatmo, red Zigbee, acabados, microrrelés para mecanismos existentes |
| `empresas-knx-dali.html` | Sectores, KNX, DALI/DALI-2, arquitectura (KNX IP, DALI, Modbus, BACnet), eficiencia y metodología |
| `proyectos.html` | Caso destacado en vídeo, galería de vídeos reales filtrable y testimonios |
| `contacto.html` | Formulario (envío automático por correo con Resend, protegido con Turnstile; alternativa por WhatsApp), datos de contacto y zonas de servicio |
| `legal.html` | Aviso legal y cookies |
| `privacidad.html` | Política de privacidad (RGPD, Meta y eliminación de datos) |

## Datos de la empresa

- Teléfono y WhatsApp: +34 649 611 494 (en `_fuente/build.py` y `js/main.js`)
- Email: info@domoticahogarmadrid.com
- Titular: David Sánchez Pérez (Domótica Hogar Madrid), NIF 53569845Q
- Política de privacidad (válida para Meta / Facebook): `privacidad.html`, con instrucciones de eliminación de datos en `privacidad.html#eliminacion-datos`

Pendiente: sustituir los **testimonios de ejemplo** de `_fuente/src/_partials/testimonios.html` por opiniones reales de clientes (con su permiso).

## Publicación y formulario (Cloudflare)

La web se publica en Cloudflare como Worker `baseweb` (ver `wrangler.jsonc`): sirve los archivos estáticos y el formulario en `/api/contacto` (`worker/index.js`). Los archivos de `.assetsignore` (`_fuente/`, `worker/`, `README.md`…) no se publican.

Secretos necesarios en **Workers & Pages → baseweb → Settings → Variables and Secrets** (tipo *Secret*):

| Nombre | Valor |
|---|---|
| `RESEND_API_KEY` | Clave de Resend con permiso de envío para domoticahogarmadrid.com |
| `TURNSTILE_SECRET` | Secret Key del widget Turnstile (la Site Key pública está en `_fuente/src/contacto.html`) |
| `MAIL_TO` | Dirección que recibe los avisos |
| `WEBHOOK_URL` | Opcional: recibe cada solicitud en JSON (`origen`, `fecha`, `nombre`, `telefono`, `email`, `municipio`, `tipo`, `intereses`, `mensaje`, `pagina`) |

Prueba en local: crea `.dev.vars` con esas variables y ejecuta `npx wrangler dev`.

## Calculadora y zona de presupuestos

| Ruta | Acceso | Qué es |
|---|---|---|
| `/calculadora-presupuesto` | Pública (sin enlaces en el menú) | Calculadora de presupuesto (`worker/presupuesto/calculadora.html`) |
| `/presupuestos` | Privada, con `PASS_PRESUPUESTO` | Listado de presupuestos (`worker/presupuesto/listado.html`) |
| `/presupuesto?id=P-0056` | Privada | Editor de presupuestos (`worker/presupuesto/editor.html`); sin `id` crea uno nuevo |
| `/acceso` · `/salir` | — | Entrar con la clave (el navegador la recuerda 180 días) y cerrar sesión |

- Precios, cámaras, textos e imágenes de la calculadora: `worker/presupuesto/config.json` (sin URLs ni claves).
- Al enviar la calculadora: aviso por correo a `MAIL_TO`, confirmación al cliente y POST JSON al webhook de n8n con la cabecera `X-Webhook-Secret`.
- Las zonas privadas no se indexan (`X-Robots-Tag: noindex`) y no se enlazan desde la web.

Secretos adicionales (tipo *Secret* en **Runtime variables and secrets**):

| Nombre | Valor |
|---|---|
| `PASS_PRESUPUESTO` | Clave de la zona privada (cambiarla cierra todas las sesiones) |
| `N8N_CALCULADORA_URL` | Webhook de n8n que recibe cada solicitud de la calculadora |
| `N8N_CALCULADORA_SECRET` | Clave enviada a ese webhook en `X-Webhook-Secret` |
| `N8N_PRESUPUESTO_DATOS_URL` | Webhook que devuelve catálogo + presupuesto (`?id=`) |
| `N8N_PRESUPUESTO_GUARDAR_URL` | Webhook que guarda un presupuesto (POST JSON) |
| `N8N_PRESUPUESTOS_LISTA_URL` | Webhook que devuelve la lista de presupuestos |
| `N8N_PRESUPUESTO_API_KEY` | Clave enviada a esos tres webhooks en `X-Api-Key` |

## Vídeos de Instagram

En `js/main.js`, añade las URLs de tus reels a `SITE.instagramPosts`:

```js
instagramPosts: [
  "https://www.instagram.com/reel/XXXXXXXXXXX/",
  "https://www.instagram.com/reel/YYYYYYYYYYY/",
],
```

Si la lista tiene contenido, la web incrusta además los reels oficiales encima de la tira de vídeos propios.

## Vídeos y logotipo

- Los vídeos están en `assets/video/` (MP4 H.264 + póster `.jpg`). Se reproducen en silencio al aparecer en pantalla y, al pulsarlos, se abren a pantalla completa con sonido.
- Para añadir uno nuevo: conviértelo con
  `ffmpeg -i video.mov -vf "scale=540:-2" -c:v libx264 -crf 27 -movflags +faststart -c:a aac -b:a 64k nombre.mp4`
  y añádelo en la tabla `VIDEOS` de `_fuente/build.py` (o copia una tarjeta `<figure class="vcard">` existente).
- Logotipo original de la empresa, sin modificar: `assets/img/logo-full.png`, `logo-icon.png` y `logo-wordmark.png` (recortes con fondo transparente del archivo original), favicon en `assets/img/favicon.png` y el original en `assets/img/logo-domotica-hogar-madrid.jpg` (imagen al compartir en redes).

## Cómo se generan las páginas

Las páginas `.html` de la raíz se generan desde `_fuente/` (cabecera, pie, iconos y tarjetas de vídeo compartidos):

```bash
python3 _fuente/build.py
```

Edita el contenido en `_fuente/src/*.html` y vuelve a ejecutar el comando. Si prefieres editar directamente los `.html` de la raíz, no regeneres después o perderás esos cambios.

## Ver en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```
