import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";

export async function POST() {
  const session = await getSession();
  if (session) {
    try {
      const db = await readDb();
      appendActivity(db, { actor: session.username, kind: "logout" });
      await writeDb(db);
    } catch {
      // best effort
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
