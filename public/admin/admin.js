/* Veyru Keyolhu admin: edits the content document served by /api/content. */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Content stores site-relative paths like "photos/x.jpg"; resolve them from /admin/.
const imgSrc = u => (!u || /^(https?:|\/|data:|blob:)/.test(u) ? u : "/" + u);

let content = null;
let tab = "tours";
let dirty = false;

/* ---------- Field definitions ---------- */
const PAGE_FIELDS = {
  home: {
    title: "Home page",
    hint: "The video header and section titles on the home page.",
    groups: [
      ["Top of page (over the video)", [
        ["eyebrow", "Small label above headline"],
        ["title", "Headline — first line"],
        ["titleEm", "Headline — second line (lighter colour)"],
        ["lead", "Intro text", "textarea"],
      ]],
      ["Experiences section", [
        ["toursEyebrow", "Small label"],
        ["toursTitle", "Title"],
        ["toursLead", "Intro text", "textarea"],
      ]],
      ["Gallery section", [
        ["galleryEyebrow", "Small label"],
        ["galleryTitle", "Title"],
      ]],
    ],
  },
  about: {
    title: "About page",
    hint: "Your story and the photo beside it.",
    groups: [
      ["Page header", [
        ["eyebrow", "Small label"],
        ["title", "Headline — first line"],
        ["titleEm", "Headline — second line (lighter colour)"],
      ]],
      ["Story", [
        ["image", "Photo", "image"],
        ["lead", "Opening sentence (large text)", "textarea"],
        ["body", "Story", "textarea-lg", "Leave an empty line between paragraphs."],
      ]],
    ],
  },
  contact: {
    title: "Contact",
    hint: "Used on the Contact page and for every “Book via WhatsApp” button.",
    groups: [
      ["Contact details", [
        ["whatsapp", "WhatsApp number", "text", "Digits only, with country code. Example: 9607925729"],
        ["instagram", "Instagram username", "text", "Without the @. Example: veyrukeyolhu"],
        ["email", "Email address", "text", "Leave empty to hide the email card on the Contact page."],
      ]],
      ["Page text", [
        ["eyebrow", "Small label"],
        ["title", "Headline"],
        ["titleEm", "Headline — ending (lighter colour)"],
        ["lead", "Intro text", "textarea"],
      ]],
    ],
  },
};

const STAYING_PAGE_FIELDS = [
  ["eyebrow", "Small label"],
  ["title", "Headline — first line"],
  ["titleEm", "Headline — second line (lighter colour)"],
  ["lead", "Intro text", "textarea"],
];

const STAY_FIELDS = [
  ["title", "Room / stay name"],
  ["tag", "Badge", "text", "Short label on the card, e.g. “Beachfront”"],
  ["short", "Card description", "textarea", "One sentence shown on the card."],
  ["cover", "Main photo", "image"],
  ["intro", "Full description", "textarea"],
  ["amenities", "Amenities", "text", "", true],
  ["guests", "Guests", "text", "e.g. Up to 2 guests", true],
  ["price", "Price", "text", "e.g. From $80/night, or “Price on request”", true],
  ["note", "Extra note (optional)", "text", "", true],
  ["photos", "More photos (shown in the popup)", "images"],
];

const TOUR_FIELDS = [
  ["title", "Tour name"],
  ["tag", "Badge", "text", "Short label on the card, e.g. “Family friendly”"],
  ["short", "Card description", "textarea", "One sentence shown on the tour card."],
  ["cover", "Main photo", "image"],
  ["intro", "Full description", "textarea"],
  ["thrill", "The thrill", "textarea"],
  ["targets", "Target fish"],
  ["equipment", "Equipment"],
  ["duration", "Duration", "text", "", true],
  ["time", "Departs", "text", "", true],
  ["level", "Level", "text", "", true],
  ["bestFor", "Best for", "text", "", true],
  ["note", "Extra note (optional)", "text", "Shown in italics, e.g. catch-and-release policy."],
  ["photos", "More photos (shown in the tour popup)", "images"],
];

/* ---------- Path helpers ---------- */
const getPath = p => p.split(".").reduce((o, k) => o?.[k], content);
function setPath(p, v) {
  const keys = p.split(".");
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), content)[last] = v;
}

/* ---------- Rendering ---------- */
function fieldHTML(path, label, type = "text", help = "") {
  const v = getPath(path) ?? "";
  if (type === "image") return imageFieldHTML(path, label);
  if (type === "images") return imagesFieldHTML(path, label);
  const input = type.startsWith("textarea")
    ? `<textarea data-path="${path}" rows="${type === "textarea-lg" ? 9 : 3}">${esc(v)}</textarea>`
    : `<input data-path="${path}" value="${esc(v)}">`;
  return `<label class="field"><span>${label}</span>${input}${help ? `<small>${help}</small>` : ""}</label>`;
}

function fieldsHTML(prefix, fields) {
  let html = "", pair = [];
  const flush = () => { if (pair.length) html += `<div class="grid2">${pair.join("")}</div>`; pair = []; };
  for (const [key, label, type, help, half] of fields) {
    const f = fieldHTML(`${prefix}.${key}`, label, type, help);
    if (half) { pair.push(f); if (pair.length === 2) flush(); }
    else { flush(); html += f; }
  }
  flush();
  return html;
}

function imageFieldHTML(path, label) {
  const v = getPath(path);
  return `<div class="field"><span>${label}</span>
    <div class="img-field">
      ${v ? `<img src="${esc(imgSrc(v))}" alt="">` : ""}
      <label class="btn btn--light btn--sm">${v ? "Replace photo" : "Upload photo"}
        <input type="file" accept="image/*" hidden data-upload-single="${path}">
      </label>
    </div></div>`;
}

function videoFieldHTML(path, label) {
  const v = getPath(path);
  return `<div class="field"><span>${label}</span>
    <div class="img-field">
      ${v ? `<video src="${esc(imgSrc(v))}" muted playsinline controls style="max-width:260px;border-radius:8px"></video>` : ""}
      <label class="btn btn--light btn--sm">${v ? "Replace video" : "Upload video"}
        <input type="file" accept="video/mp4" hidden data-upload-video="${path}">
      </label>
      <small>MP4 only (H.264), up to 40 MB. Convert other formats before uploading.</small>
    </div></div>`;
}

function heroMediaHTML() {
  const type = getPath("staying.heroType") || "video";
  const radio = (val, label) => `<label class="radio">
    <input type="radio" name="heroType" value="${val}" data-hero-type ${type === val ? "checked" : ""}> ${label}
  </label>`;
  return `
    <div class="field"><span>Type</span>
      <div class="radio-group">${radio("video", "Video")}${radio("image", "Photo")}</div>
    </div>
    ${type === "image" ? imageFieldHTML("staying.heroImage", "Hero photo") : videoFieldHTML("staying.heroVideo", "Hero video")}`;
}

function imagesFieldHTML(path, label) {
  const list = getPath(path) || [];
  return `<div class="field"><span>${label}</span>
    <div class="thumbs">
      ${list.map((u, i) => `
        <div class="thumb">
          <img src="${esc(imgSrc(u))}" alt="" loading="lazy">
          <div class="thumb__tools">
            <span>
              <button class="icon-btn" title="Move left" data-move="${path}" data-i="${i}" data-d="-1">←</button>
              <button class="icon-btn" title="Move right" data-move="${path}" data-i="${i}" data-d="1">→</button>
            </span>
            <button class="icon-btn icon-btn--danger" title="Remove" data-remove="${path}" data-i="${i}">✕</button>
          </div>
        </div>`).join("")}
      <label class="add-tile">+ Add photos<input type="file" accept="image/*" multiple hidden data-upload-multi="${path}"></label>
    </div></div>`;
}

function render() {
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tab));
  const panel = $("#panel");

  if (tab === "tours") {
    const openIdx = [...panel.querySelectorAll(".tour-item[open]")].map(d => d.dataset.i);
    panel.innerHTML = `
      <div class="panel__head"><div><h2>Tours</h2><p>Tap a tour to edit it. Use the arrows to change the order on the site.</p></div>
        <button class="btn btn--light btn--sm" id="addTour">+ Add tour</button></div>
      ${content.tours.map((t, i) => `
        <details class="tour-item" data-i="${i}" ${openIdx.includes(String(i)) ? "open" : ""}>
          <summary>
            ${t.cover ? `<img src="${esc(imgSrc(t.cover))}" alt="">` : `<img alt="">`}
            <strong>${esc(t.title || "Untitled tour")}</strong>
            <span class="tools">
              <button class="icon-btn" title="Move up" data-move="tours" data-i="${i}" data-d="-1">↑</button>
              <button class="icon-btn" title="Move down" data-move="tours" data-i="${i}" data-d="1">↓</button>
              <button class="icon-btn icon-btn--danger" title="Delete tour" data-delete-tour="${i}">✕</button>
            </span>
          </summary>
          <div class="tour-item__body">${fieldsHTML(`tours.${i}`, TOUR_FIELDS)}</div>
        </details>`).join("")}`;
    return;
  }

  if (tab === "stays") {
    const openIdx = [...panel.querySelectorAll(".tour-item[open]")].map(d => d.dataset.i);
    content.stays ??= [];
    panel.innerHTML = `
      <div class="panel__head"><div><h2>Staying</h2><p>The page text below, and the rooms/stays listed on it.</p></div></div>
      <section class="card"><h3>Hero media</h3><p class="muted">Shown full-width at the top of the Staying page.</p>${heroMediaHTML()}</section>
      <section class="card"><h3>Page text</h3>${fieldsHTML("staying", STAYING_PAGE_FIELDS)}</section>
      <div class="panel__head"><div><h3>Rooms &amp; stays</h3><p>Tap one to edit it. Use the arrows to change the order on the site.</p></div>
        <button class="btn btn--light btn--sm" id="addStay">+ Add stay</button></div>
      ${content.stays.map((s, i) => `
        <details class="tour-item" data-i="${i}" ${openIdx.includes(String(i)) ? "open" : ""}>
          <summary>
            ${s.cover ? `<img src="${esc(imgSrc(s.cover))}" alt="">` : `<img alt="">`}
            <strong>${esc(s.title || "Untitled stay")}</strong>
            <span class="tools">
              <button class="icon-btn" title="Move up" data-move="stays" data-i="${i}" data-d="-1">↑</button>
              <button class="icon-btn" title="Move down" data-move="stays" data-i="${i}" data-d="1">↓</button>
              <button class="icon-btn icon-btn--danger" title="Delete stay" data-delete-stay="${i}">✕</button>
            </span>
          </summary>
          <div class="tour-item__body">${fieldsHTML(`stays.${i}`, STAY_FIELDS)}</div>
        </details>`).join("")}`;
    return;
  }

  if (tab === "gallery") {
    panel.innerHTML = `
      <div class="panel__head"><div><h2>Gallery</h2><p>Photos in the “Straight from the boat” section, in this order.</p></div></div>
      <div class="card">${imagesFieldHTML("gallery", `${content.gallery.length} photos`)}</div>`;
    return;
  }

  const page = PAGE_FIELDS[tab];
  panel.innerHTML = `
    <div class="panel__head"><div><h2>${page.title}</h2><p>${page.hint}</p></div></div>
    ${page.groups.map(([title, fields]) => `<section class="card"><h3>${title}</h3>${fieldsHTML(tab, fields)}</section>`).join("")}`;
}

/* ---------- State ---------- */
function markDirty() {
  dirty = true;
  $("#savebar").classList.add("is-dirty");
  $("#saveStatus").textContent = "Unsaved changes";
  $("#saveBtn").disabled = false;
}

function toast(msg, error = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("is-error", error);
  t.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("is-visible"), 3000);
}

/* ---------- Photos ---------- */
// Shrink photos in the browser before upload (max 1920px JPEG) so the site stays fast.
async function prepareImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.82));
  } catch {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return file;
    throw new Error(`Can't read “${file.name}”. Try a JPG or PNG (iPhone HEIC photos may need converting).`);
  }
}

async function uploadFile(file) {
  const blob = await prepareImage(file);
  const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  if (r.status === 401) { showLogin(); throw new Error("Session expired — please sign in again."); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Upload failed");
  return data.url;
}

async function handleUpload(input, multi) {
  const files = [...input.files];
  if (!files.length) return;
  const path = multi ? input.dataset.uploadMulti : input.dataset.uploadSingle;
  const holder = input.closest(".field");
  holder.classList.add("uploading");
  toast(`Uploading ${files.length} photo${files.length > 1 ? "s" : ""}…`);
  try {
    for (const f of files) {
      const url = await uploadFile(f);
      if (multi) setPath(path, [...(getPath(path) || []), url]);
      else setPath(path, url);
    }
    markDirty();
    toast("Photo uploaded — remember to save");
  } catch (e) {
    toast(e.message, true);
  }
  render();
}

// Videos aren't run through the image canvas pipeline — uploaded as-is.
async function handleVideoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const path = input.dataset.uploadVideo;
  toast("Uploading video…");
  try {
    if (file.type !== "video/mp4") throw new Error("Please choose an MP4 video file.");
    const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "video/mp4" }, body: file });
    if (r.status === 401) { showLogin(); throw new Error("Session expired — please sign in again."); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Upload failed");
    setPath(path, data.url);
    markDirty();
    toast("Video uploaded — remember to save");
  } catch (e) {
    toast(e.message, true);
  }
  render();
}

/* ---------- Events ---------- */
$("#panel").addEventListener("input", e => {
  const p = e.target.dataset.path;
  if (!p) return;
  setPath(p, e.target.value);
  markDirty();
  if (/^tours\.\d+\.title$/.test(p)) e.target.closest(".tour-item").querySelector("summary strong").textContent = e.target.value || "Untitled tour";
  if (/^stays\.\d+\.title$/.test(p)) e.target.closest(".tour-item").querySelector("summary strong").textContent = e.target.value || "Untitled stay";
});

$("#panel").addEventListener("change", e => {
  if (e.target.dataset.uploadSingle) handleUpload(e.target, false);
  if (e.target.dataset.uploadMulti) handleUpload(e.target, true);
  if (e.target.dataset.uploadVideo) handleVideoUpload(e.target);
  if (e.target.dataset.heroType !== undefined) {
    setPath("staying.heroType", e.target.value);
    markDirty();
    render();
  }
});

$("#panel").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;

  if (b.id === "addTour") {
    content.tours.push({ id: "tour-" + Date.now(), title: "New tour", tag: "", short: "", cover: "", photos: [] });
    render();
    const items = document.querySelectorAll(".tour-item");
    items[items.length - 1].open = true;
    items[items.length - 1].scrollIntoView({ behavior: "smooth" });
    markDirty();
    return;
  }

  if (b.id === "addStay") {
    content.stays.push({ id: "stay-" + Date.now(), title: "New stay", tag: "", short: "", cover: "", photos: [] });
    render();
    const items = document.querySelectorAll(".tour-item");
    items[items.length - 1].open = true;
    items[items.length - 1].scrollIntoView({ behavior: "smooth" });
    markDirty();
    return;
  }

  if (b.dataset.move) {
    e.preventDefault(); // don't toggle the <details>
    const list = getPath(b.dataset.move);
    const i = +b.dataset.i, j = i + +b.dataset.d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    markDirty();
    render();
    return;
  }

  if (b.dataset.remove) {
    const list = getPath(b.dataset.remove);
    list.splice(+b.dataset.i, 1);
    markDirty();
    render();
    return;
  }

  if (b.dataset.deleteTour) {
    e.preventDefault();
    const t = content.tours[+b.dataset.deleteTour];
    if (!confirm(`Delete “${t.title || "this tour"}”? It will disappear from the site after you save.`)) return;
    content.tours.splice(+b.dataset.deleteTour, 1);
    markDirty();
    render();
    return;
  }

  if (b.dataset.deleteStay) {
    e.preventDefault();
    const s = content.stays[+b.dataset.deleteStay];
    if (!confirm(`Delete “${s.title || "this stay"}”? It will disappear from the site after you save.`)) return;
    content.stays.splice(+b.dataset.deleteStay, 1);
    markDirty();
    render();
  }
});

$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  tab = b.dataset.tab;
  render();
  window.scrollTo(0, 0);
});

$("#saveBtn").addEventListener("click", async () => {
  const btn = $("#saveBtn");
  btn.disabled = true;
  $("#saveStatus").textContent = "Saving…";
  try {
    const r = await fetch("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    if (r.status === 401) { showLogin(); throw new Error("Session expired — sign in and save again."); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Save failed");
    dirty = false;
    $("#savebar").classList.remove("is-dirty");
    $("#saveStatus").textContent = "All changes saved";
    toast("Saved — the website is updated");
  } catch (e) {
    $("#saveStatus").textContent = "Not saved";
    btn.disabled = false;
    toast(e.message, true);
  }
});

window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- Auth ---------- */
function showLogin() {
  $("#loginView").hidden = false;
  $("#editorView").hidden = true;
}

async function showEditor() {
  if (!content) {
    const r = await fetch("/api/content", { cache: "no-store" });
    content = await r.json();
    content.tours ??= [];
    content.stays ??= [];
    content.gallery ??= [];
    for (const k of ["home", "about", "staying", "contact"]) content[k] ??= {};
    content.staying.heroType ??= "video";
    content.staying.heroVideo ??= "";
    content.staying.heroPoster ??= "";
    content.staying.heroImage ??= "";
  }
  $("#loginView").hidden = true;
  $("#editorView").hidden = false;
  render();
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  $("#loginError").textContent = "";
  try {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: e.target.password.value }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Sign in failed");
    e.target.reset();
    await showEditor();
  } catch (err) {
    $("#loginError").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  if (dirty && !confirm("You have unsaved changes. Log out anyway?")) return;
  await fetch("/api/logout", { method: "POST" });
  dirty = false;
  content = null;
  showLogin();
});

fetch("/api/session", { cache: "no-store" })
  .then(r => r.json())
  .then(d => (d.authed ? showEditor() : showLogin()))
  .catch(() => {
    showLogin();
    $("#loginError").textContent = "Admin only works on the Cloudflare site (or with “wrangler pages dev”).";
  });
