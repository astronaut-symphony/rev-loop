import { put, get } from "@vercel/blob";
import { randomUUID } from "crypto";
import type { Activity, Database, Document, TimelineEvent } from "./types";

const BLOB_PATHNAME = "data/documents.json";

const emptyDb = (): Database => ({ documents: [], activities: [] });

type LegacyRevision = {
  id: string;
  tanggalRevisi: string;
  tanggalKirim?: string;
  note?: string;
  addedBy: string;
  addedAt: string;
};

type RawEvent = {
  id: string;
  type: string;
  date?: string;
  tanggal?: string;
  note?: string;
  todos?: { id: string; text: string }[];
  revisionId?: string;
  revisiId?: string;
  checkedTodoIds?: string[];
  addedBy: string;
  addedAt: string;
};

type RawDocument = {
  id: string;
  projectName: string;
  documentName: string;
  status?: string;
  completedAt?: string;
  completedBy?: string;
  selesaiAt?: string;
  selesaiBy?: string;
  archived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  createdBy: string;
  createdAt: string;
  timeline?: RawEvent[];
  revisions?: LegacyRevision[];
};

function migrateStatus(s: string | undefined): "in_progress" | "completed" {
  if (s === "completed" || s === "selesai") return "completed";
  return "in_progress";
}

function migrateEventType(t: string): "submission" | "revision" | "update" | null {
  if (t === "submission" || t === "submisi") return "submission";
  if (t === "revision" || t === "revisi") return "revision";
  if (t === "update") return "update";
  return null;
}

function migrateEvent(e: RawEvent): TimelineEvent | null {
  const type = migrateEventType(e.type);
  if (!type) return null;
  const date = e.date ?? e.tanggal ?? "";
  if (type === "submission") {
    return {
      id: e.id,
      type: "submission",
      date,
      note: e.note ?? "",
      addedBy: e.addedBy,
      addedAt: e.addedAt,
    };
  }
  if (type === "revision") {
    return {
      id: e.id,
      type: "revision",
      date,
      note: e.note ?? "",
      todos: e.todos ?? [],
      addedBy: e.addedBy,
      addedAt: e.addedAt,
    };
  }
  return {
    id: e.id,
    type: "update",
    date,
    note: e.note ?? "",
    revisionId: e.revisionId ?? e.revisiId ?? "",
    checkedTodoIds: e.checkedTodoIds ?? [],
    addedBy: e.addedBy,
    addedAt: e.addedAt,
  };
}

function migrateDocument(raw: RawDocument): Document {
  let timeline: TimelineEvent[];
  if (raw.timeline) {
    timeline = raw.timeline
      .map(migrateEvent)
      .filter((e): e is TimelineEvent => e !== null);
  } else if (raw.revisions) {
    timeline = raw.revisions.map((r) => ({
      id: r.id,
      type: "revision" as const,
      date: r.tanggalRevisi,
      note: [r.note, r.tanggalKirim ? `(sent ${r.tanggalKirim})` : ""]
        .filter(Boolean)
        .join(" ")
        .trim(),
      todos: [],
      addedBy: r.addedBy,
      addedAt: r.addedAt,
    }));
  } else {
    timeline = [];
  }

  return {
    id: raw.id,
    projectName: raw.projectName,
    documentName: raw.documentName,
    status: migrateStatus(raw.status),
    completedAt: raw.completedAt ?? raw.selesaiAt,
    completedBy: raw.completedBy ?? raw.selesaiBy,
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt,
    archivedBy: raw.archivedBy,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    timeline,
  };
}

function deriveActivitiesFromDocuments(documents: Document[]): Activity[] {
  const activities: Activity[] = [];

  for (const doc of documents) {
    activities.push({
      id: randomUUID(),
      timestamp: doc.createdAt,
      actor: doc.createdBy,
      kind: "document_created",
      docId: doc.id,
      documentName: doc.documentName,
      projectName: doc.projectName,
    });

    const sortedTimeline = [...doc.timeline].sort((a, b) => {
      const t = a.date.localeCompare(b.date);
      return t !== 0 ? t : a.addedAt.localeCompare(b.addedAt);
    });
    const revisionMap = new Map<string, number>();
    let revIdx = 0;
    for (const e of sortedTimeline) {
      if (e.type === "revision") {
        revIdx++;
        revisionMap.set(e.id, revIdx);
      }
    }

    for (const e of doc.timeline) {
      let label: string;
      if (e.type === "submission") label = "Submission";
      else if (e.type === "revision") label = `Revision #${revisionMap.get(e.id) ?? "?"}`;
      else {
        const n = revisionMap.get(e.revisionId);
        label = n ? `Update → Revision #${n}` : "Update";
      }
      activities.push({
        id: randomUUID(),
        timestamp: e.addedAt,
        actor: e.addedBy,
        kind: "event_added",
        docId: doc.id,
        documentName: doc.documentName,
        projectName: doc.projectName,
        eventType: e.type,
        eventLabel: label,
      });
    }

    if (doc.status === "completed" && doc.completedAt) {
      activities.push({
        id: randomUUID(),
        timestamp: doc.completedAt,
        actor: doc.completedBy ?? "—",
        kind: "status_changed",
        docId: doc.id,
        documentName: doc.documentName,
        projectName: doc.projectName,
        toStatus: "completed",
      });
    }

    if (doc.archived && doc.archivedAt) {
      activities.push({
        id: randomUUID(),
        timestamp: doc.archivedAt,
        actor: doc.archivedBy ?? "—",
        kind: "archive_changed",
        docId: doc.id,
        documentName: doc.documentName,
        projectName: doc.projectName,
        archived: true,
      });
    }
  }

  return activities;
}

export async function readDb(): Promise<Database> {
  try {
    const result = await get(BLOB_PATHNAME, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return emptyDb();
    const text = await new Response(result.stream).text();
    const data = JSON.parse(text) as { documents?: RawDocument[]; activities?: Activity[] };
    if (!data || !Array.isArray(data.documents)) return emptyDb();
    const documents = data.documents.map(migrateDocument);
    const activities = Array.isArray(data.activities)
      ? data.activities
      : deriveActivitiesFromDocuments(documents);
    return { documents, activities };
  } catch {
    return emptyDb();
  }
}

export async function writeDb(db: Database): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(db, null, 2), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
  });
}
