import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE, verifyCredentials } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";

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
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }
  if (!verifyCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const token = await createSessionToken(username);
  try {
    const db = await readDb();
    appendActivity(db, { actor: username, kind: "login" });
    await writeDb(db);
  } catch {
    // best effort
  }
  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
