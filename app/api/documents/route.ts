import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
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
    return NextResponse.json({ error: "Nama project dan dokumen wajib diisi" }, { status: 400 });
  }
  const db = await readDb();
  const doc: Document = {
    id: randomUUID(),
    projectName,
    documentName,
    createdBy: session.username,
    createdAt: new Date().toISOString(),
    revisions: [],
  };
  db.documents.push(doc);
  await writeDb(db);
  return NextResponse.json(doc, { status: 201 });
}
