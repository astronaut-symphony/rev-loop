import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/blob";
import { appendActivity } from "@/lib/activity";
import type { TimelineEvent } from "@/lib/types";

function revisionNumberFor(
  timeline: TimelineEvent[],
  revisionId: string,
): number | null {
  const sorted = [...timeline].sort((a, b) => {
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, eventId } = await params;
  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const target = doc.timeline.find((e) => e.id === eventId);
  if (!target) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (target.type === "revision") {
    const hasDependentUpdate = doc.timeline.some(
      (e) => e.type === "update" && e.revisionId === eventId,
    );
    if (hasDependentUpdate) {
      return NextResponse.json(
        { error: "This revision has linked updates. Delete those first." },
        { status: 409 },
      );
    }
  }

  let label: string;
  if (target.type === "submission") {
    label = "Submission";
  } else if (target.type === "revision") {
    const n = revisionNumberFor(doc.timeline, target.id);
    label = n ? `Revision #${n}` : "Revision";
  } else {
    const n = revisionNumberFor(doc.timeline, target.revisionId);
    label = n ? `Update → Revision #${n}` : "Update";
  }

  doc.timeline = doc.timeline.filter((e) => e.id !== eventId);
  appendActivity(db, {
    actor: session.username,
    kind: "event_deleted",
    docId: doc.id,
    documentName: doc.documentName,
    projectName: doc.projectName,
    eventType: target.type,
    eventLabel: label,
  });

  await writeDb(db);
  return NextResponse.json({ ok: true });
}
