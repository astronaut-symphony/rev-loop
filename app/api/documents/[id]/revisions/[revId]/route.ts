import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; revId: string }> },
) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, revId } = await params;
  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  const before = doc.revisions.length;
  doc.revisions = doc.revisions.filter((r) => r.id !== revId);
  if (doc.revisions.length === before) {
    return NextResponse.json({ error: "Revisi tidak ditemukan" }, { status: 404 });
  }
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
