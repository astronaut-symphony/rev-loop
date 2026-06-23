import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { archived?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof body.archived !== "boolean") {
    return NextResponse.json({ error: "archived must be boolean" }, { status: 400 });
  }

  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const previousArchived = doc.archived;
  doc.archived = body.archived;
  if (body.archived) {
    doc.archivedAt = new Date().toISOString();
    doc.archivedBy = session.username;
  } else {
    delete doc.archivedAt;
    delete doc.archivedBy;
  }

  if (previousArchived !== body.archived) {
    appendActivity(db, {
      actor: session.username,
      kind: "archive_changed",
      docId: doc.id,
      documentName: doc.documentName,
      projectName: doc.projectName,
      archived: body.archived,
    });
  }

  await writeDb(db);
  return NextResponse.json(doc);
}
