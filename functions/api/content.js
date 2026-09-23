import { json, isAuthed, unauthorized } from "../_lib/auth.js";

const KEY = "content";
const MAX_BYTES = 512 * 1024;

// Public: the site reads its content from here. Falls back to the bundled content.json
// until the admin saves for the first time.
export async function onRequestGet({ request, env }) {
  const saved = await env.SITE.get(KEY);
  if (saved) return new Response(saved, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return env.ASSETS.fetch(new URL("/content.json", request.url));
}

// Admin only: replace the whole content document. The previous version is kept as a backup.
export async function onRequestPut({ request, env }) {
  if (!(await isAuthed(request, env))) return unauthorized();

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: "Content is too large" }, 413);

  let data;
  try { data = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (typeof data !== "object" || !Array.isArray(data.tours) || !Array.isArray(data.gallery)) {
    return json({ error: "Content must include tours and gallery lists" }, 400);
  }

  const prev = await env.SITE.get(KEY);
  if (prev) await env.SITE.put(`${KEY}:backup`, prev);
  await env.SITE.put(KEY, JSON.stringify(data));
  return json({ ok: true });
}
