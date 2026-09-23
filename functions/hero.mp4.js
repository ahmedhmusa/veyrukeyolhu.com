// Safari only plays <video> when the server answers byte-range requests with
// "206 Partial Content". Serve the hero clip with proper range support.
export async function onRequestGet({ request, env }) {
  const range = request.headers.get("Range");
  const asset = await env.ASSETS.fetch(new Request(request.url, { headers: range ? { Range: range } : {} }));
  if (!asset.ok) return asset;

  const headers = new Headers(asset.headers);
  headers.set("Content-Type", "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=604800");

  // The asset server already handled the range — pass it through.
  if (asset.status === 206 || !range) return new Response(asset.body, { status: asset.status, headers });

  const buf = await asset.arrayBuffer();
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = m && m[1] !== "" ? Number(m[1]) : NaN;
  let end = m && m[2] !== "" ? Number(m[2]) : size - 1;
  if (m && m[1] === "" && m[2] !== "") { start = Math.max(0, size - Number(m[2])); end = size - 1; } // suffix range: last N bytes
  if (!m || Number.isNaN(start) || start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  end = Math.min(end, size - 1);

  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(buf.slice(start, end + 1), { status: 206, headers });
}
