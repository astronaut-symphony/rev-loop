import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE, verifyCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username dan password wajib diisi" }, { status: 400 });
  }
  if (!verifyCredentials(username, password)) {
    return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
  }
  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
