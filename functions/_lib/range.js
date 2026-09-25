// Shared byte-range serving. Safari refuses to play <video> unless the server
// answers Range requests with "206 Partial Content" — needed for both the
// bundled hero clips and any video an admin uploads via /api/upload.
export function serveRange(request, body, contentType, extraHeaders = {}) {
  const buf = body instanceof ArrayBuffer ? body : body.buffer ?? body;
  const size = buf.byteLength;
  const headers = new Headers({
    "Content-Type": contentType || "application/octet-stream",
    "Accept-Ranges": "bytes",
    ...extraHeaders,
  });

  const range = request.headers.get("Range");
  if (!range) {
    headers.set("Content-Length", String(size));
    return new Response(buf, { status: 200, headers });
  }

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
