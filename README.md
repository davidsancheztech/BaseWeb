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
| `contacto.html` | Formulario (envía por email o WhatsApp), datos de contacto y zonas de servicio |
| `legal.html` | Aviso legal y cookies |
| `privacidad.html` | Política de privacidad (RGPD, Meta y eliminación de datos) |

## Datos de la empresa

- Teléfono y WhatsApp: +34 649 611 494 (en `_fuente/build.py` y `js/main.js`)
- Email: info@domoticahogarmadrid.com
- Titular: David Sánchez Pérez (Domótica Hogar Madrid), NIF 53569845Q
- Política de privacidad (válida para Meta / Facebook): `privacidad.html`, con instrucciones de eliminación de datos en `privacidad.html#eliminacion-datos`

Pendiente: sustituir los **testimonios de ejemplo** de `_fuente/src/_partials/testimonios.html` por opiniones reales de clientes (con su permiso).

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
