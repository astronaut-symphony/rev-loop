import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";
import type {
  Document,
  RevisionEvent,
  TimelineEvent,
} from "@/lib/types";

type BatchRevisionBody = {
  type: "revision";
  documentIds?: string[];
  date?: string;
  note?: string;
  todos?: { text?: string }[];
};

type BatchUpdateBody = {
  type: "update";
  documentIds?: string[];
  date?: string;
  note?: string;
};

type BatchBody = BatchRevisionBody | BatchUpdateBody;

function latestRevision(doc: Document): RevisionEvent | null {
  const revisions = doc.timeline.filter(
    (e): e is RevisionEvent => e.type === "revision",
  );
  if (revisions.length === 0) return null;
  revisions.sort((a, b) => {
    const t = a.date.localeCompare(b.date);
    return t !== 0 ? t : a.addedAt.localeCompare(b.addedAt);
  });
  return revisions[revisions.length - 1];
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BatchBody;
  try {
    body = (await req.json()) as BatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (body.type !== "revision" && body.type !== "update") {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }
  const documentIds = body.documentIds ?? [];
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds is required" }, { status: 400 });
  }
  const date = (body.date ?? "").trim();
  const note = (body.note ?? "").trim();
  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const db = await readDb();
  const now = new Date().toISOString();
  const applied: { documentId: string; eventId: string }[] = [];
  const skipped: { documentId: string; reason: string }[] = [];

  if (body.type === "revision") {
    const sharedTodos = (body.todos ?? [])
      .map((t) => (t?.text ?? "").trim())
      .filter((text) => text.length > 0)
      .map((text) => ({ text }));

    for (const id of documentIds) {
      const doc = db.documents.find((d) => d.id === id);
      if (!doc) {
        skipped.push({ documentId: id, reason: "Document not found" });
        continue;
      }
      const event: RevisionEvent = {
        id: randomUUID(),
        type: "revision",
        date,
        note,
        todos: sharedTodos.map((t) => ({ id: randomUUID(), text: t.text })),
        addedBy: session.username,
        addedAt: now,
      };
      doc.timeline.push(event);
      applied.push({ documentId: doc.id, eventId: event.id });
    }
  } else {
    for (const id of documentIds) {
      const doc = db.documents.find((d) => d.id === id);
      if (!doc) {
        skipped.push({ documentId: id, reason: "Document not found" });
        continue;
      }
      const target = latestRevision(doc);
      if (!target) {
        skipped.push({ documentId: id, reason: "No revision to update" });
        continue;
      }
      const event: TimelineEvent = {
        id: randomUUID(),
        type: "update",
        date,
        note,
        revisionId: target.id,
        checkedTodoIds: [],
        addedBy: session.username,
        addedAt: now,
      };
      doc.timeline.push(event);
      applied.push({ documentId: doc.id, eventId: event.id });
    }
  }

  if (applied.length > 0) {
    appendActivity(db, {
      actor: session.username,
      kind: "batch_added",
      eventType: body.type === "revision" ? "revision" : "update",
      eventLabel: body.type === "revision" ? "Batch Revision" : "Batch Update",
      batchCount: applied.length,
    });
    await writeDb(db);
  }
  return NextResponse.json({ applied, skipped });
}
