// Serves photos uploaded through the admin page. Keys are never reused, so responses
// are cached at the edge for a year.
export async function onRequestGet({ request, params, env, waitUntil }) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const key = [].concat(params.path || []).join("/");
  const { value, metadata } = await env.SITE.getWithMetadata(key, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });

  const res = new Response(value, {
    headers: {
      "Content-Type": metadata?.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  waitUntil(cache.put(request, res.clone()));
  return res;
}
