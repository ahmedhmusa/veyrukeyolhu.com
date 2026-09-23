import { json, isAuthed, unauthorized } from "../_lib/auth.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 10 * 1024 * 1024;

function sniff(b) {
  const ascii = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 3) === "GIF") return "image/gif";
  return "";
}

// Admin only: store an uploaded photo in KV and return its public URL (/media/...).
export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) return unauthorized();

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: "Empty file" }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: "Image is larger than 10 MB" }, 413);

  // Trust the file's actual bytes, not the Content-Type header.
  const type = sniff(new Uint8Array(body, 0, Math.min(12, body.byteLength)));
  const ext = TYPES[type];
  if (!ext) return json({ error: "Only JPEG, PNG, WebP or GIF images are allowed" }, 415);

  const key = `img/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.SITE.put(key, body, { metadata: { type } });
  return json({ url: `/media/${key}` });
}
