# Domótica Hogar Madrid — Web corporativa

Web estática (HTML + CSS + JS, sin dependencias ni build) para **domoticahogarmadrid.com**.
Se puede publicar tal cual en cualquier hosting (Netlify, Vercel, GitHub Pages, cPanel…).

## Páginas

| Archivo | Contenido |
|---|---|
| `index.html` | Portada: hero con panel animado de Home Assistant, marcas, servicios, escenas interactivas, cifras, proceso, proyectos, testimonios, Instagram, FAQ |
| `domotica-hogar.html` | Home Assistant, qué se automatiza, Shelly / Sonoff / Aqara / Airzone / Legrand / Hue, comparativa de protocolos, ahorro energético y packs |
| `interruptores-zigbee.html` | Mecanismos Legrand with Netatmo, red Zigbee, acabados, microrrelés para mecanismos existentes |
| `empresas-knx-dali.html` | Sectores, KNX, DALI/DALI-2, arquitectura (KNX IP, DALI, Modbus, BACnet), eficiencia y metodología |
| `proyectos.html` | Caso destacado, galería filtrable, testimonios e Instagram |
| `contacto.html` | Formulario (envía por email o WhatsApp), datos de contacto y zonas de servicio |
| `legal.html` | Aviso legal, privacidad y cookies |

## Antes de publicar: datos a sustituir

Busca y reemplaza en todos los `.html` y en `js/main.js`:

- **Teléfono**: `+34 600 000 000`, `+34600000000` y `34600000000` (WhatsApp)
- **Email**: `info@domoticahogarmadrid.com`
- **Instagram**: `domoticahogarmadrid`
- **Redes** del pie: enlaces genéricos a YouTube y LinkedIn
- **Cifras** de la portada (`+150 proyectos`, `4,9★`) — marcadas con `<!-- EDITAR -->`
- **Testimonios y proyectos**: son ejemplos ilustrativos. Sustitúyelos por casos y opiniones reales (con permiso del cliente); publicar opiniones inventadas no está permitido.
- **legal.html**: titular, NIF y dirección.

## Vídeos de Instagram

En `js/main.js`, añade las URLs de tus reels a `SITE.instagramPosts`:

```js
instagramPosts: [
  "https://www.instagram.com/reel/XXXXXXXXXXX/",
  "https://www.instagram.com/reel/YYYYYYYYYYY/",
],
```

Si la lista tiene contenido, la web incrusta los reels oficiales; si está vacía, muestra tarjetas de diseño que enlazan al perfil.

## Fotos reales

Los visuales están hechos en CSS/SVG para que la web funcione sin imágenes. Para usar fotos de proyectos, guárdalas en `assets/img/` y, en cada tarjeta de proyecto, sustituye `<div class="art art-1"></div>` (y el `div.art-svg` contiguo) por `<img src="assets/img/foto.jpg" alt="Descripción">`.

## Ver en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```
