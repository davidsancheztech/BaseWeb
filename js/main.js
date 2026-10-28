/* ==========================================================================
   Domótica Hogar Madrid — Interacciones
   ========================================================================== */

/* Datos de contacto y redes: edítalos aquí (y en el HTML, buscando los mismos valores). */
const SITE = {
  email: "info@domoticahogarmadrid.com",
  whatsapp: "34600000000", // Sin "+" ni espacios
  instagramUser: "domoticahogarmadrid",
  // Pega aquí las URLs de tus reels/publicaciones para mostrarlos incrustados.
  // Ejemplo: "https://www.instagram.com/reel/XXXXXXXXXXX/"
  instagramPosts: [],
};

document.documentElement.classList.remove("no-js");

/* Cabecera al hacer scroll */
const header = document.querySelector(".site-header");
const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 24);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* Menú móvil */
const toggle = document.querySelector(".nav-toggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll(".nav a").forEach((a) =>
    a.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

/* Animaciones de entrada */
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

/* Contadores */
const counters = document.querySelectorAll("[data-count]");
const runCounter = (el) => {
  const target = parseFloat(el.dataset.count);
  const decimals = (el.dataset.count.split(".")[1] || "").length;
  const duration = 1600;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * eased).toFixed(decimals).replace(".", ",");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
if ("IntersectionObserver" in window) {
  const co = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          runCounter(e.target);
          co.unobserve(e.target);
        }
      }),
    { threshold: 0.6 }
  );
  counters.forEach((el) => co.observe(el));
}

/* Mockup del panel: las fichas se encienden al pulsar y cambian solas */
const tiles = document.querySelectorAll(".tile[data-toggle]");
tiles.forEach((tile) => {
  tile.setAttribute("role", "button");
  tile.setAttribute("tabindex", "0");
  const flip = () => {
    const on = tile.classList.toggle("is-on");
    const state = tile.querySelector(".tile__state");
    if (state) state.textContent = on ? tile.dataset.on || "Encendido" : tile.dataset.off || "Apagado";
    tile.setAttribute("aria-pressed", String(on));
  };
  tile.addEventListener("click", flip);
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  });
});
if (tiles.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let i = 0;
  setInterval(() => {
    tiles[i % tiles.length].click();
    i++;
  }, 2600);
}

/* Escenas del salón */
const room = document.querySelector(".room");
const sceneTabs = document.querySelectorAll(".scene-tab");
const sceneCaption = document.querySelector(".scene-caption");
const sceneDetails = {
  morning: ["Persianas al 90 %", "Clima a 21 °C", "Luz cálida al 40 %", "Cafetera encendida"],
  away: ["Todo apagado", "Alarma armada", "Simulación de presencia", "Clima en eco"],
  cinema: ["Persianas cerradas", "Luz ambiente al 10 %", "Tira LED ámbar", "TV y barra de sonido"],
  night: ["Puertas comprobadas", "Luz de pasillo al 5 %", "Clima nocturno", "Persianas cerradas"],
};
const setScene = (name) => {
  if (!room) return;
  room.dataset.scene = name;
  sceneTabs.forEach((t) => {
    const active = t.dataset.scene === name;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", String(active));
  });
  if (sceneCaption && sceneDetails[name]) {
    sceneCaption.innerHTML = sceneDetails[name].map((d) => `<span>${d}</span>`).join("");
  }
};
sceneTabs.forEach((t) => t.addEventListener("click", () => setScene(t.dataset.scene)));
if (room) setScene(room.dataset.scene || "morning");

/* Carrusel de testimonios */
document.querySelectorAll("[data-carousel]").forEach((wrap) => {
  const track = wrap.querySelector(".t-track");
  const step = () => (track.querySelector(".t-card")?.offsetWidth || 300) + 24;
  wrap.querySelector("[data-prev]")?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  wrap.querySelector("[data-next]")?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
});

/* Filtro de proyectos */
const filterBtns = document.querySelectorAll(".filter-btn");
filterBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    const f = btn.dataset.filter;
    filterBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
    document.querySelectorAll(".project").forEach((p) => {
      p.classList.toggle("is-hidden", f !== "all" && !p.dataset.cat.split(" ").includes(f));
    });
  })
);

/* Instagram: si hay publicaciones configuradas, se incrustan las oficiales */
const instaEmbeds = document.querySelector("[data-insta-embeds]");
if (instaEmbeds && SITE.instagramPosts.length) {
  instaEmbeds.hidden = false;
  instaEmbeds.innerHTML = SITE.instagramPosts
    .map(
      (url) =>
        `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"><a href="${url}">Ver en Instagram</a></blockquote>`
    )
    .join("");
  document.querySelector("[data-insta-fallback]")?.setAttribute("hidden", "");
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.instagram.com/embed.js";
  document.body.appendChild(s);
}

/* Formulario de contacto: prepara el mensaje por email o WhatsApp */
const form = document.querySelector("#contact-form");
if (form) {
  const buildMessage = () => {
    const d = new FormData(form);
    const interests = d.getAll("interes").join(", ") || "Sin especificar";
    return [
      `Nombre: ${d.get("nombre") || ""}`,
      `Teléfono: ${d.get("telefono") || ""}`,
      `Email: ${d.get("email") || ""}`,
      `Tipo de proyecto: ${d.get("tipo") || ""}`,
      `Me interesa: ${interests}`,
      `Municipio: ${d.get("municipio") || ""}`,
      "",
      d.get("mensaje") || "",
    ].join("\n");
  };
  const ok = form.querySelector(".form-success");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const subject = encodeURIComponent("Solicitud de estudio — web");
    window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${encodeURIComponent(buildMessage())}`;
    ok?.classList.add("is-visible");
  });
  form.querySelector("[data-wa-submit]")?.addEventListener("click", () => {
    if (!form.reportValidity()) return;
    window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(buildMessage())}`, "_blank", "noopener");
    ok?.classList.add("is-visible");
  });
}

/* Año en el pie */
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

/* Vídeos: se reproducen en silencio al entrar en pantalla y se pausan al salir */
const autoVideos = document.querySelectorAll("video[data-autoplay]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if ("IntersectionObserver" in window && !reduceMotion) {
  const vo = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting) {
          if (v.preload === "none") v.preload = "auto";
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      }),
    { threshold: 0.35 }
  );
  autoVideos.forEach((v) => vo.observe(v));
}

/* Reproductor a pantalla completa con sonido */
const lightbox = document.querySelector(".lightbox");
if (lightbox) {
  const lbVideo = lightbox.querySelector("video");
  const lbCaption = lightbox.querySelector(".lightbox__caption");
  const close = () => {
    lbVideo.pause();
    lbVideo.removeAttribute("src");
    lbVideo.load();
    lightbox.hidden = true;
    document.body.style.overflow = "";
  };
  document.querySelectorAll("[data-video]").forEach((card) => {
    const open = () => {
      lbVideo.src = card.dataset.video;
      lbVideo.poster = card.dataset.poster || "";
      lbCaption.textContent = card.dataset.title || "";
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      lbVideo.muted = false;
      lbVideo.play().catch(() => {});
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
  lightbox.querySelector(".lightbox__close").addEventListener("click", close);
  lightbox.addEventListener("click", (e) => e.target === lightbox && close());
  document.addEventListener("keydown", (e) => e.key === "Escape" && !lightbox.hidden && close());
}

/* Flechas de la tira de vídeos */
const vtrack = document.querySelector("[data-vtrack]");
if (vtrack) {
  const vstep = () => (vtrack.querySelector(".vcard")?.offsetWidth || 260) + 18;
  document.querySelector("[data-vprev]")?.addEventListener("click", () => vtrack.scrollBy({ left: -vstep() * 2, behavior: "smooth" }));
  document.querySelector("[data-vnext]")?.addEventListener("click", () => vtrack.scrollBy({ left: vstep() * 2, behavior: "smooth" }));
}

/* Barra de progreso de lectura */
const progress = document.querySelector(".scroll-progress");
if (progress) {
  const setProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  setProgress();
  window.addEventListener("scroll", setProgress, { passive: true });
}

/* Luz que sigue al cursor en tarjetas */
document.querySelectorAll(".card, .proto, .eco, .step, .pack, .t-card, .bento-tile").forEach((el) => {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});
