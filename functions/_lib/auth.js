// Shared helpers for the admin API: signed session cookie + JSON responses.

const COOKIE = "vk_admin";
const SESSION_DAYS = 7;
const enc = new TextEncoder();

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

const signingSecret = env => env.SESSION_SECRET || env.ADMIN_PASSWORD;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

// Compare two strings without leaking where they differ (compare their HMACs).
export async function safeEqual(a, b, secret) {
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)]);
  return x.length === y.length && x === y;
}

export async function sessionCookie(env) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const token = `${exp}.${await hmac(signingSecret(env), String(exp))}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAuthed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sig === (await hmac(signingSecret(env), exp));
}

export const unauthorized = () => json({ error: "Not logged in" }, 401);
