import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import type { Revision } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { tanggalRevisi?: string; tanggalKirim?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const tanggalRevisi = (body.tanggalRevisi ?? "").trim();
  const tanggalKirim = (body.tanggalKirim ?? "").trim();
  const note = (body.note ?? "").trim();
  if (!tanggalRevisi || !tanggalKirim) {
    return NextResponse.json({ error: "Tanggal revisi dan tanggal kirim wajib diisi" }, { status: 400 });
  }
  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  const rev: Revision = {
    id: randomUUID(),
    tanggalRevisi,
    tanggalKirim,
    note,
    addedBy: session.username,
    addedAt: new Date().toISOString(),
  };
  doc.revisions.push(rev);
  await writeDb(db);
  return NextResponse.json(rev, { status: 201 });
}
