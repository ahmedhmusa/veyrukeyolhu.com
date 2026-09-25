import { json, isAuthed, unauthorized } from "../_lib/auth.js";

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

function sniff(b) {
  const ascii = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 3) === "GIF") return "image/gif";
  // MP4/MOV family: an "ftyp" box a few bytes in. Only MP4 brands are accepted —
  // there's no server-side transcoding here, so the file must already be a
  // browser-playable MP4 (H.264/AAC).
  if (b.length > 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(brand)) return "video/mp4";
  }
  return "";
}

// Admin only: store an uploaded photo or video in KV and return its public URL (/media/...).
export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) return unauthorized();

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: "Empty file" }, 400);

  // Trust the file's actual bytes, not the Content-Type header.
  const type = sniff(new Uint8Array(body, 0, Math.min(16, body.byteLength)));

  if (type === "video/mp4") {
    if (body.byteLength > MAX_VIDEO_BYTES) return json({ error: "Video is larger than 40 MB" }, 413);
    const key = `img/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.mp4`;
    await env.SITE.put(key, body, { metadata: { type } });
    return json({ url: `/media/${key}` });
  }

  const ext = IMAGE_TYPES[type];
  if (!ext) return json({ error: "Only JPEG, PNG, WebP, GIF images or MP4 video are allowed" }, 415);
  if (body.byteLength > MAX_IMAGE_BYTES) return json({ error: "Image is larger than 10 MB" }, 413);

  const key = `img/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.SITE.put(key, body, { metadata: { type } });
  return json({ url: `/media/${key}` });
}
