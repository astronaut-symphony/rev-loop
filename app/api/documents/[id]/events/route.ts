import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";
import type { RevisionEvent, SubmissionEvent, TimelineEvent, UpdateEvent } from "@/lib/types";

function revisionNumberFor(doc: { timeline: TimelineEvent[] }, revisionId: string): number | null {
  const sorted = [...doc.timeline].sort((a, b) => {
    const t = a.date.localeCompare(b.date);
    return t !== 0 ? t : a.addedAt.localeCompare(b.addedAt);
  });
  let idx = 0;
  for (const e of sorted) {
    if (e.type === "revision") {
      idx++;
      if (e.id === revisionId) return idx;
    }
  }
  return null;
}

type CreateSubmissionBody = {
  type: "submission";
  date?: string;
  note?: string;
};

type CreateRevisionBody = {
  type: "revision";
  date?: string;
  note?: string;
  todos?: { text?: string }[];
};

type CreateUpdateBody = {
  type: "update";
  date?: string;
  note?: string;
  revisionId?: string;
  checkedTodoIds?: string[];
};

type CreateBody = CreateSubmissionBody | CreateRevisionBody | CreateUpdateBody;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (body.type !== "submission" && body.type !== "revision" && body.type !== "update") {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const date = (body.date ?? "").trim();
  const note = (body.note ?? "").trim();
  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  let event: TimelineEvent;
  if (body.type === "submission") {
    const hasSubmission = doc.timeline.some((e) => e.type === "submission");
    if (hasSubmission) {
      return NextResponse.json(
        { error: "This document already has a submission" },
        { status: 409 },
      );
    }
    const submission: SubmissionEvent = {
      id: randomUUID(),
      type: "submission",
      date,
      note,
      addedBy: session.username,
      addedAt: new Date().toISOString(),
    };
    event = submission;
  } else if (body.type === "revision") {
    const todos = (body.todos ?? [])
      .map((t) => (t?.text ?? "").trim())
      .filter((text) => text.length > 0)
      .map((text) => ({ id: randomUUID(), text }));
    const revision: RevisionEvent = {
      id: randomUUID(),
      type: "revision",
      date,
      note,
      todos,
      addedBy: session.username,
      addedAt: new Date().toISOString(),
    };
    event = revision;
  } else {
    const revisionId = (body.revisionId ?? "").trim();
    if (!revisionId) {
      return NextResponse.json(
        { error: "Update must reference a revision" },
        { status: 400 },
      );
    }
    const targetRevision = doc.timeline.find(
      (e): e is RevisionEvent => e.type === "revision" && e.id === revisionId,
    );
    if (!targetRevision) {
      return NextResponse.json(
        { error: "Referenced revision not found" },
        { status: 400 },
      );
    }
    const validTodoIds = new Set(targetRevision.todos.map((t) => t.id));
    const checkedTodoIds = (body.checkedTodoIds ?? []).filter((tid) => validTodoIds.has(tid));
    const update: UpdateEvent = {
      id: randomUUID(),
      type: "update",
      date,
      note,
      revisionId,
      checkedTodoIds,
      addedBy: session.username,
      addedAt: new Date().toISOString(),
    };
    event = update;
  }

  doc.timeline.push(event);

  let label: string;
  if (event.type === "submission") {
    label = "Submission";
  } else if (event.type === "revision") {
    const n = revisionNumberFor(doc, event.id);
    label = n ? `Revision #${n}` : "Revision";
  } else {
    const n = revisionNumberFor(doc, event.revisionId);
    label = n ? `Update → Revision #${n}` : "Update";
  }
  appendActivity(db, {
    actor: session.username,
    kind: "event_added",
    docId: doc.id,
    documentName: doc.documentName,
    projectName: doc.projectName,
    eventType: event.type,
    eventLabel: label,
  });

  await writeDb(db);
  return NextResponse.json(event, { status: 201 });
}
