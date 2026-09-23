import { json, safeEqual, sessionCookie } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ADMIN_PASSWORD is not set in Cloudflare yet." }, 500);
  }
  const { password = "" } = await request.json().catch(() => ({}));
  if (!(await safeEqual(String(password), env.ADMIN_PASSWORD, env.ADMIN_PASSWORD))) {
    await new Promise(r => setTimeout(r, 1000)); // slow down password guessing
    return json({ error: "Wrong password" }, 401);
  }
  return json({ ok: true }, 200, { "Set-Cookie": await sessionCookie(env) });
}
