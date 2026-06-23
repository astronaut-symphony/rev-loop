import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";
import type { DocumentStatus } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { status?: DocumentStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const status = body.status;
  if (status !== "in_progress" && status !== "completed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const previousStatus = doc.status;
  doc.status = status;
  if (status === "completed") {
    doc.completedAt = new Date().toISOString();
    doc.completedBy = session.username;
  } else {
    delete doc.completedAt;
    delete doc.completedBy;
  }

  if (previousStatus !== status) {
    appendActivity(db, {
      actor: session.username,
      kind: "status_changed",
      docId: doc.id,
      documentName: doc.documentName,
      projectName: doc.projectName,
      toStatus: status,
    });
  }

  await writeDb(db);
  return NextResponse.json(doc);
}
