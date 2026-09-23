/* All editable content lives in content.json (defaults) and is overridden by
   what the admin saves at /admin (served from /api/content on Cloudflare). */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const get = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);

async function loadContent() {
  for (const url of ["/api/content", "content.json"]) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}

const igUrl = handle => `https://www.instagram.com/${handle.replace(/^@/, "")}/`;
// "9607925729" -> "+960 792 5729" (Maldives numbers); other countries shown as +digits.
const formatPhone = n => (/^960\d{7}$/.test(n) ? `+960 ${n.slice(3, 6)} ${n.slice(6)}` : "+" + n);
const waLink = (number, text) => `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

function applyText(c) {
  document.querySelectorAll("[data-bind]").forEach(el => {
    const v = get(c, el.dataset.bind);
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll("[data-bind-title]").forEach(el => {
    const s = c[el.dataset.bindTitle];
    if (!s) return;
    const sep = el.hasAttribute("data-inline") ? " " : "<br>";
    el.innerHTML = `${esc(s.title)}${sep}<em>${esc(s.titleEm)}</em>`;
  });
  document.querySelectorAll("[data-bind-src]").forEach(el => {
    const v = get(c, el.dataset.bindSrc);
    if (v) el.src = v;
  });
  document.querySelectorAll("[data-bind-paras]").forEach(el => {
    const v = get(c, el.dataset.bindParas);
    if (v) el.innerHTML = v.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join("");
  });

  const ct = c.contact || {};
  document.querySelectorAll("[data-contact]").forEach(el => {
    const kind = el.dataset.contact;
    if (kind === "whatsapp" && ct.whatsapp) { el.href = waLink(ct.whatsapp); el.querySelector("strong").textContent = formatPhone(ct.whatsapp); }
    if (kind === "email") { el.hidden = !ct.email; if (ct.email) { el.href = "mailto:" + ct.email; el.querySelector("strong").textContent = ct.email; } }
    if (kind === "instagram" && ct.instagram) { el.href = igUrl(ct.instagram); el.querySelector("strong").textContent = "@" + ct.instagram.replace(/^@/, ""); }
  });
  if (ct.instagram) document.querySelectorAll("[data-ig]").forEach(a => (a.href = igUrl(ct.instagram)));
  if (ct.whatsapp) document.querySelectorAll("[data-wa]").forEach(a => (a.href = waLink(ct.whatsapp)));
}

/* ---------- Tours ---------- */
function renderTours(c) {
  const grid = document.getElementById("toursGrid");
  if (!grid) return;
  const tours = c.tours || [];
  grid.innerHTML = tours.map((t, i) => `
    <button class="tour reveal" data-tour="${i}">
      <img src="${esc(t.cover)}" alt="" loading="lazy">
      <div class="tour__body">
        ${t.tag ? `<span class="tour__tag">${esc(t.tag)}</span>` : ""}
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.short)}</p>
        <div class="tour__meta">${t.duration ? `<span>⏱ ${esc(t.duration)}</span>` : ""}${t.level ? `<span>◎ ${esc(t.level)}</span>` : ""}</div>
        <span class="tour__more">View details</span>
      </div>
    </button>`).join("");

  grid.addEventListener("click", e => {
    const card = e.target.closest("[data-tour]");
    if (card) openTour(tours[card.dataset.tour], c.contact?.whatsapp);
  });
}

function openTour(t, whatsapp) {
  const modal = document.getElementById("tourModal");
  const facts = [["Targets", t.targets], ["Equipment", t.equipment], ["Duration", t.duration], ["Departs", t.time], ["Level", t.level], ["Best for", t.bestFor]]
    .filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
  const photos = (t.photos || []).filter(Boolean);
  document.getElementById("modalBody").innerHTML = `
    <img class="modal__hero" src="${esc(t.cover)}" alt="">
    <div class="modal__content">
      ${t.tag ? `<p class="eyebrow">${esc(t.tag)}</p>` : ""}
      <h2>${esc(t.title)}</h2>
      ${t.intro ? `<p>${esc(t.intro)}</p>` : ""}
      ${t.thrill ? `<p><strong>The thrill:</strong> ${esc(t.thrill)}</p>` : ""}
      ${facts ? `<dl class="modal__facts">${facts}</dl>` : ""}
      ${t.note ? `<p class="muted"><em>${esc(t.note)}</em></p>` : ""}
      ${photos.length ? `<div class="modal__thumbs">${photos.map(p => `<img src="${esc(p)}" alt="" loading="lazy">`).join("")}</div>` : ""}
      ${whatsapp ? `<a href="${waLink(whatsapp, `Hi Veyru Keyolhu! I'm interested in the ${t.title} trip.`)}" target="_blank" rel="noopener" class="btn btn--full">Book via WhatsApp</a>` : ""}
    </div>`;
  modal.showModal();
  modal.scrollTop = 0;
}

/* ---------- Gallery + lightbox ---------- */
const GALLERY_PREVIEW = 6;
function renderGallery(c) {
  const gal = document.getElementById("galleryGrid");
  if (!gal) return;
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const photos = c.gallery || [];
  gal.innerHTML = photos.map((src, i) =>
    `<button class="reveal"${i >= GALLERY_PREVIEW ? " hidden data-extra" : ""}><img src="${esc(src)}" alt="Fishing trip photo" loading="lazy"></button>`).join("");

  // Show the first few photos; the rest appear when "See more photos" is tapped.
  const more = document.getElementById("galleryMore");
  const extra = photos.length - GALLERY_PREVIEW;
  if (more && extra > 0) {
    const btn = more.querySelector("button");
    const label = open => (btn.textContent = open ? "Show fewer photos" : `See more photos (${extra})`);
    label(false);
    more.hidden = false;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      gal.querySelectorAll("[data-extra]").forEach(b => (b.hidden = !open));
      btn.setAttribute("aria-expanded", open);
      label(open);
      if (!open) document.getElementById("gallery").scrollIntoView({ behavior: "smooth" });
    });
  }
  gal.addEventListener("click", e => {
    const img = e.target.closest("button")?.querySelector("img");
    if (!img) return;
    lightboxImg.src = img.src;
    lightbox.showModal();
  });
}

/* Close dialogs via × button or backdrop click */
document.querySelectorAll("dialog").forEach(d => {
  d.addEventListener("click", e => {
    if (e.target === d || e.target.hasAttribute("data-close")) d.close();
  });
});

/* ---------- Hero video: seamless cross-fading loop ---------- */
// Two copies of the clip take turns: shortly before one ends, the other starts from
// the beginning and fades in on top, so the loop never visibly jumps.
const heroVideos = [...document.querySelectorAll(".hero__video")];
if (heroVideos.length === 2 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const FADE = 1.4; // seconds, matches the CSS opacity transition
  let current = 0;
  heroVideos.forEach(v => { v.muted = true; v.loop = false; });
  const play = v => v.play().catch(() => {});
  play(heroVideos[0]);
  document.addEventListener("click", () => play(heroVideos[current]), { once: true });
  // Browsers pause background tabs; resume when the visitor comes back (Safari needs this).
  document.addEventListener("visibilitychange", () => { if (!document.hidden) play(heroVideos[current]); });

  const tick = () => {
    const a = heroVideos[current], b = heroVideos[1 - current];
    if (a.duration && a.currentTime >= a.duration - FADE) {
      b.currentTime = 0;
      play(b);
      b.classList.add("is-active");
      a.classList.remove("is-active");
      current = 1 - current;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
} else if (heroVideos[0]) {
  heroVideos[0].muted = true;
  heroVideos[0].play().catch(() => {});
}

/* ---------- Nav ---------- */
const nav = document.getElementById("nav");
const toggle = document.getElementById("navToggle");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", open);
});
document.getElementById("navLinks").addEventListener("click", e => {
  if (e.target.closest("a")) { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", false); }
});

/* ---------- Scroll reveal ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
}, { threshold: .12 });
function observeReveals() {
  document.querySelectorAll(".section__head, .split > *, .contact-card").forEach(el => el.classList.add("reveal"));
  document.querySelectorAll(".reveal:not(.is-visible)").forEach(el => io.observe(el));
}

document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Boot ---------- */
loadContent().then(c => {
  if (c) {
    applyText(c);
    renderTours(c);
    renderGallery(c);
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  }
  observeReveals();
});
