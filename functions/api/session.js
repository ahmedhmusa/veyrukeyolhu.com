import { json, isAuthed } from "../_lib/auth.js";

export const onRequestGet = async ({ request, env }) => json({ authed: await isAuthed(request, env) });
