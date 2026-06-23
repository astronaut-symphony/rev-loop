import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await readDb();
  const target = db.documents.find((d) => d.id === id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  db.documents = db.documents.filter((d) => d.id !== id);
  appendActivity(db, {
    actor: session.username,
    kind: "document_deleted",
    docId: target.id,
    documentName: target.documentName,
    projectName: target.projectName,
  });
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
