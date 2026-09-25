// Serves photos and videos uploaded through the admin page. Keys are never reused,
// so full (non-range) responses are cached at the edge for a year. Range requests
// (needed for Safari <video> playback) are always served fresh from KV — caching a
// single byte range under the same URL-keyed cache entry could leak it to a later
// request for a different range or the full file.
import { serveRange } from "../_lib/range.js";

export async function onRequestGet({ request, params, env, waitUntil }) {
  const key = [].concat(params.path || []).join("/");
  const range = request.headers.get("Range");
  const cache = caches.default;

  if (!range) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

  const { value, metadata } = await env.SITE.getWithMetadata(key, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });

  const res = serveRange(request, value, metadata?.type, { "Cache-Control": "public, max-age=31536000, immutable" });
  if (!range && res.status === 200) waitUntil(cache.put(request, res.clone()));
  return res;
}
