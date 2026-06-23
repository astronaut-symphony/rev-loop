import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await readDb();
  const before = db.documents.length;
  db.documents = db.documents.filter((d) => d.id !== id);
  if (db.documents.length === before) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
