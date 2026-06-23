import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";
import type { Document } from "@/lib/types";

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await readDb();
  return NextResponse.json(db.documents);
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { projectName?: string; documentName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const projectName = (body.projectName ?? "").trim();
  const documentName = (body.documentName ?? "").trim();
  if (!projectName || !documentName) {
    return NextResponse.json(
      { error: "Project name and document name are required" },
      { status: 400 },
    );
  }
  const db = await readDb();
  const doc: Document = {
    id: randomUUID(),
    projectName,
    documentName,
    status: "in_progress",
    archived: false,
    createdBy: session.username,
    createdAt: new Date().toISOString(),
    timeline: [],
  };
  db.documents.push(doc);
  appendActivity(db, {
    actor: session.username,
    kind: "document_created",
    docId: doc.id,
    documentName: doc.documentName,
    projectName: doc.projectName,
  });
  await writeDb(db);
  return NextResponse.json(doc, { status: 201 });
}
