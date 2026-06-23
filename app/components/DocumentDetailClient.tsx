"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Document,
  DocumentStatus,
  RevisionEvent,
  SubmissionEvent,
  TimelineEvent,
  UpdateEvent,
} from "@/lib/types";

type FormMode = "submission" | "revision" | "update" | null;

type DraftTodo = { tempId: string; text: string };

function nextTempId() {
  return Math.random().toString(36).slice(2);
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function compareEventsAsc(a: TimelineEvent, b: TimelineEvent): number {
  const t = a.date.localeCompare(b.date);
  if (t !== 0) return t;
  return a.addedAt.localeCompare(b.addedAt);
}

export default function DocumentDetailClient({
  initialDocument,
}: {
  initialDocument: Document;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<Document>(initialDocument);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [todos, setTodos] = useState<DraftTodo[]>([{ tempId: nextTempId(), text: "" }]);
  const [revisionId, setRevisionId] = useState<string>("");
  const [checkedTodoIds, setCheckedTodoIds] = useState<string[]>([]);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.documentName);
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const chronological = useMemo(
    () => [...doc.timeline].sort(compareEventsAsc),
    [doc.timeline],
  );

  const reversed = useMemo(() => [...chronological].reverse(), [chronological]);

  const groupedByMonth = useMemo(() => {
    const groups: { key: string; label: string; events: TimelineEvent[] }[] = [];
    for (const e of reversed) {
      const key = (e.date || "").slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.events.push(e);
      } else {
        groups.push({ key, label: monthLabel(key), events: [e] });
      }
    }
    return groups;
  }, [reversed]);

  const revisionList = useMemo(
    () => chronological.filter((e): e is RevisionEvent => e.type === "revision"),
    [chronological],
  );

  const revisionIndex = useMemo(() => {
    const map = new Map<string, number>();
    revisionList.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [revisionList]);

  const hasSubmission = useMemo(
    () => doc.timeline.some((e) => e.type === "submission"),
    [doc.timeline],
  );

  const selectedRevision = useMemo(
    () => revisionList.find((r) => r.id === revisionId) ?? null,
    [revisionList, revisionId],
  );

  function resetForm() {
    setDate(todayIso());
    setNote("");
    setTodos([{ tempId: nextTempId(), text: "" }]);
    setRevisionId("");
    setCheckedTodoIds([]);
    setError(null);
  }

  function openForm(mode: FormMode) {
    resetForm();
    if (mode === "update" && revisionList.length > 0) {
      const last = revisionList[revisionList.length - 1];
      setRevisionId(last.id);
    }
    setFormMode(mode);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload =
        formMode === "submission"
          ? { type: "submission" as const, date, note }
          : formMode === "revision"
            ? {
                type: "revision" as const,
                date,
                note,
                todos: todos.map((t) => ({ text: t.text })),
              }
            : {
                type: "update" as const,
                date,
                note,
                revisionId,
                checkedTodoIds,
              };

      const res = await fetch(`/api/documents/${doc.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setDoc({ ...doc, timeline: [...doc.timeline, data as TimelineEvent] });
      resetForm();
      setFormMode(null);
      router.refresh();
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteEvent(eventId: string) {
    if (!confirm("Delete this event?")) return;
    const res = await fetch(`/api/documents/${doc.id}/events/${eventId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Failed to delete");
      return;
    }
    setDoc({ ...doc, timeline: doc.timeline.filter((e) => e.id !== eventId) });
    router.refresh();
  }

  function startRename() {
    setRenameValue(doc.documentName);
    setRenameError(null);
    setRenaming(true);
  }

  async function onRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = renameValue.trim();
    if (!next) {
      setRenameError("Document name is required");
      return;
    }
    if (next === doc.documentName) {
      setRenaming(false);
      return;
    }
    setRenameError(null);
    setRenameSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentName: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenameError(data.error ?? "Failed to rename");
        return;
      }
      setDoc(data as Document);
      setRenaming(false);
      router.refresh();
    } catch {
      setRenameError("Failed to connect to server");
    } finally {
      setRenameSubmitting(false);
    }
  }

  async function onToggleStatus() {
    const next: DocumentStatus = doc.status === "completed" ? "in_progress" : "completed";
    if (next === "completed" && !confirm("Mark this document as complete?")) return;
    if (next === "in_progress" && !confirm("Reopen this document?")) return;
    const res = await fetch(`/api/documents/${doc.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Failed to change status");
      return;
    }
    setDoc(data as Document);
    router.refresh();
  }

  async function onToggleArchive() {
    const next = !doc.archived;
    if (next && !confirm("Archive this document?")) return;
    if (!next && !confirm("Unarchive this document?")) return;
    const res = await fetch(`/api/documents/${doc.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Failed to archive");
      return;
    }
    setDoc(data as Document);
    router.refresh();
  }

  async function onDeleteDocument() {
    if (
      !confirm(
        `Permanently delete "${doc.documentName}" and its entire timeline? This cannot be undone.`,
      )
    )
      return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/project/${encodeURIComponent(doc.projectName)}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          &larr; Back to {doc.projectName}
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{doc.projectName}</p>
            {renaming ? (
              <form onSubmit={onRenameSubmit} className="mt-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    autoFocus
                    required
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setRenaming(false);
                        setRenameError(null);
                      }
                    }}
                    className="text-xl font-semibold text-slate-900 rounded-lg border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 min-w-0 flex-1"
                  />
                  <button
                    type="submit"
                    disabled={renameSubmitting}
                    className="rounded-lg bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {renameSubmitting ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(false);
                      setRenameError(null);
                    }}
                    className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-1.5 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
                {renameError && (
                  <p className="text-sm text-red-600">{renameError}</p>
                )}
              </form>
            ) : (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-900">{doc.documentName}</h1>
                <StatusBadge status={doc.status} />
                {doc.archived && (
                  <span className="text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5">
                    Archived
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Created by {doc.createdBy} &middot; {doc.createdAt.slice(0, 10)}
              {doc.status === "completed" && doc.completedAt && (
                <>
                  {" "}&middot; Completed {doc.completedAt.slice(0, 10)}
                  {doc.completedBy ? ` by ${doc.completedBy}` : ""}
                </>
              )}
              {doc.archived && doc.archivedAt && (
                <>
                  {" "}&middot; Archived {doc.archivedAt.slice(0, 10)}
                  {doc.archivedBy ? ` by ${doc.archivedBy}` : ""}
                </>
              )}
            </p>
          </div>
          <ActionMenu
            isCompleted={doc.status === "completed"}
            isArchived={doc.archived}
            onRename={startRename}
            onToggleStatus={onToggleStatus}
            onToggleArchive={onToggleArchive}
            onDelete={onDeleteDocument}
          />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Timeline ({doc.timeline.length} {doc.timeline.length === 1 ? "event" : "events"})
        </h2>
        <div className="flex gap-2 flex-wrap">
          {!hasSubmission && formMode !== "submission" && (
            <button
              onClick={() => openForm("submission")}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-50"
            >
              + Add Submission
            </button>
          )}
          {formMode !== "revision" && (
            <button
              onClick={() => openForm("revision")}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-3 py-2 hover:bg-slate-800"
            >
              + Add Revision
            </button>
          )}
          {formMode !== "update" && (
            <button
              onClick={() => openForm("update")}
              disabled={revisionList.length === 0}
              title={revisionList.length === 0 ? "Add a revision first" : ""}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Update
            </button>
          )}
        </div>
      </div>

      {formMode === "submission" && (
        <form
          onSubmit={onSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm"
        >
          <p className="text-lg font-semibold text-slate-900">New submission</p>
          <p className="text-xs text-slate-500">
            The initial submission of the document. The document was created earlier; this
            records when it was actually submitted to the reviewer. Only one submission per
            document.
          </p>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Submission Date</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Submission context..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormMode(null);
                resetForm();
              }}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Submission"}
            </button>
          </div>
        </form>
      )}

      {formMode === "revision" && (
        <form
          onSubmit={onSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm"
        >
          <p className="text-lg font-semibold text-slate-900">New revision</p>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Revision Date</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Revision context..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">Todo list</span>
            <p className="text-xs text-slate-500">
              Items that need to be addressed. They can be checked off in Update events.
            </p>
            <div className="space-y-2">
              {todos.map((t, idx) => (
                <div key={t.tempId} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5 text-right">{idx + 1}.</span>
                  <input
                    type="text"
                    value={t.text}
                    onChange={(e) =>
                      setTodos((prev) =>
                        prev.map((p) =>
                          p.tempId === t.tempId ? { ...p, text: e.target.value } : p,
                        ),
                      )
                    }
                    placeholder="e.g., fix endpoint /users"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTodos((prev) =>
                        prev.length === 1
                          ? [{ tempId: nextTempId(), text: "" }]
                          : prev.filter((p) => p.tempId !== t.tempId),
                      )
                    }
                    className="text-slate-400 hover:text-red-600 text-sm px-2"
                    title="Remove item"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTodos((prev) => [...prev, { tempId: nextTempId(), text: "" }])}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              + Add item
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormMode(null);
                resetForm();
              }}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Revision"}
            </button>
          </div>
        </form>
      )}

      {formMode === "update" && (
        <form
          onSubmit={onSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm"
        >
          <p className="text-lg font-semibold text-slate-900">New update</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Update Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Revision being addressed</span>
              <select
                required
                value={revisionId}
                onChange={(e) => {
                  setRevisionId(e.target.value);
                  setCheckedTodoIds([]);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white"
              >
                {revisionList.map((r) => (
                  <option key={r.id} value={r.id}>
                    Revision #{revisionIndex.get(r.id)} &middot; {r.date}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was done in this update..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          {selectedRevision && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">
                Check the todos addressed in this update
              </span>
              {selectedRevision.todos.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  This revision has no todo items.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedRevision.todos.map((todo) => {
                    const checked = checkedTodoIds.includes(todo.id);
                    return (
                      <label
                        key={todo.id}
                        className="flex items-center gap-2 text-sm cursor-pointer py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setCheckedTodoIds((prev) =>
                              e.target.checked
                                ? [...prev, todo.id]
                                : prev.filter((tid) => tid !== todo.id),
                            )
                          }
                          className="rounded border-slate-300"
                        />
                        <span className="text-slate-700">{todo.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormMode(null);
                resetForm();
              }}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Update"}
            </button>
          </div>
        </form>
      )}

      {reversed.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          No events in the timeline yet.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByMonth.map((group) => (
            <section key={group.key}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 ml-3">
                {group.label}
              </h3>
              <ol className="relative border-l-2 border-slate-200 ml-3 space-y-4">
                {group.events.map((event) => (
                  <li key={event.id} className="ml-6">
                    <span
                      className={
                        "absolute -left-[9px] mt-1.5 w-4 h-4 rounded-full border-2 border-white " +
                        (event.type === "submission"
                          ? "bg-sky-600"
                          : event.type === "revision"
                            ? "bg-amber-500"
                            : "bg-emerald-600")
                      }
                    />
                    {event.type === "submission" ? (
                      <SubmissionCard event={event} onDelete={() => onDeleteEvent(event.id)} />
                    ) : event.type === "revision" ? (
                      <RevisionCard
                        event={event}
                        index={revisionIndex.get(event.id) ?? 0}
                        allUpdates={chronological.filter(
                          (e): e is UpdateEvent =>
                            e.type === "update" && e.revisionId === event.id,
                        )}
                        onDelete={() => onDeleteEvent(event.id)}
                      />
                    ) : (
                      <UpdateCard
                        event={event}
                        revision={revisionList.find((r) => r.id === event.revisionId) ?? null}
                        revisionNumber={revisionIndex.get(event.revisionId) ?? 0}
                        onDelete={() => onDeleteEvent(event.id)}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionMenu({
  isCompleted,
  isArchived,
  onRename,
  onToggleStatus,
  onToggleArchive,
  onDelete,
}: {
  isCompleted: boolean;
  isArchived: boolean;
  onRename: () => void;
  onToggleStatus: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Actions"
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-md py-1 z-10"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onRename)}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onToggleStatus)}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {isCompleted ? "Reopen" : "Mark Complete"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onToggleArchive)}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {isArchived ? "Unarchive" : "Archive"}
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onDelete)}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete document
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  if (status === "completed") {
    return (
      <span className="text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
        Completed
      </span>
    );
  }
  return (
    <span className="text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5">
      In Progress
    </span>
  );
}

function SubmissionCard({
  event,
  onDelete,
}: {
  event: SubmissionEvent;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5">
              Submission
            </span>
            <span className="text-sm text-slate-700">{event.date}</span>
          </div>
          {event.note && (
            <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{event.note}</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 whitespace-nowrap"
        >
          Delete
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        by {event.addedBy} &middot; {event.addedAt.slice(0, 10)}
      </p>
    </div>
  );
}

function RevisionCard({
  event,
  index,
  allUpdates,
  onDelete,
}: {
  event: RevisionEvent;
  index: number;
  allUpdates: UpdateEvent[];
  onDelete: () => void;
}) {
  const doneTodoIds = useMemo(() => {
    const s = new Set<string>();
    for (const u of allUpdates) for (const tid of u.checkedTodoIds) s.add(tid);
    return s;
  }, [allUpdates]);

  const hasAnyUpdate = allUpdates.length > 0;
  const pendingTodos = event.todos.filter((t) => !doneTodoIds.has(t.id));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5">
              Revision #{index}
            </span>
            <span className="text-sm text-slate-700">{event.date}</span>
          </div>
          {event.note && (
            <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{event.note}</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 whitespace-nowrap"
        >
          Delete
        </button>
      </div>

      {event.todos.length > 0 && !hasAnyUpdate && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Todos ({event.todos.length})
          </p>
          <ul className="space-y-1 list-disc list-inside marker:text-slate-300">
            {event.todos.map((todo) => (
              <li key={todo.id} className="text-sm text-slate-700">
                {todo.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAnyUpdate && pendingTodos.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">
            Not addressed ({pendingTodos.length} of {event.todos.length})
          </p>
          <ul className="space-y-1">
            {pendingTodos.map((todo) => (
              <li key={todo.id} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="font-bold">✗</span>
                <span>{todo.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAnyUpdate && event.todos.length > 0 && pendingTodos.length === 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-emerald-700">
            All {event.todos.length} {event.todos.length === 1 ? "todo" : "todos"} addressed
          </p>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        by {event.addedBy} &middot; {event.addedAt.slice(0, 10)}
      </p>
    </div>
  );
}

function UpdateCard({
  event,
  revision,
  revisionNumber,
  onDelete,
}: {
  event: UpdateEvent;
  revision: RevisionEvent | null;
  revisionNumber: number;
  onDelete: () => void;
}) {
  const checkedSet = new Set(event.checkedTodoIds);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
              Update
            </span>
            <span className="text-sm text-slate-700">{event.date}</span>
            {revision && (
              <span className="text-xs text-slate-500">
                &rarr; Revision #{revisionNumber}
              </span>
            )}
          </div>
          {event.note && (
            <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{event.note}</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 whitespace-nowrap"
        >
          Delete
        </button>
      </div>

      {revision && revision.todos.length > 0 && (() => {
        const addressed = revision.todos.filter((t) => checkedSet.has(t.id));
        if (addressed.length === 0) {
          return (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500 italic">
                No todos from Revision #{revisionNumber} addressed in this update.
              </p>
            </div>
          );
        }
        return (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">
              Addressed from Revision #{revisionNumber} ({addressed.length} of {revision.todos.length})
            </p>
            <ul className="space-y-1">
              {addressed.map((todo) => (
                <li key={todo.id} className="flex items-start gap-2 text-sm text-emerald-700">
                  <span className="font-bold">✓</span>
                  <span>{todo.text}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {!revision && (
        <p className="text-xs text-slate-400 mt-2 italic">Linked revision was deleted.</p>
      )}

      <p className="text-xs text-slate-400 mt-3">
        by {event.addedBy} &middot; {event.addedAt.slice(0, 10)}
      </p>
    </div>
  );
}
