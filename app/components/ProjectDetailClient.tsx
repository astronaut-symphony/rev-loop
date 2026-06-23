"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Document } from "@/lib/types";

type DraftTodo = { tempId: string; text: string };
type BatchMode = "revision" | "update" | null;

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

type LastEvent = {
  label: string;
  date: string;
  type: "submission" | "revision" | "update";
};

function lastEventInfo(doc: Document): LastEvent | null {
  if (doc.timeline.length === 0) return null;
  const sorted = [...doc.timeline].sort((a, b) => {
    const t = a.date.localeCompare(b.date);
    return t !== 0 ? t : a.addedAt.localeCompare(b.addedAt);
  });
  const last = sorted[sorted.length - 1];
  const label =
    last.type === "submission" ? "Submission" : last.type === "revision" ? "Revision" : "Update";
  return { label, date: last.date, type: last.type };
}

function eventChipClasses(type: LastEvent["type"]): string {
  if (type === "submission")
    return "bg-sky-50 text-sky-700 border-sky-200";
  if (type === "revision")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function EventChip({ event }: { event: LastEvent }) {
  return (
    <span
      className={
        "text-xs font-medium rounded-full border px-2 py-0.5 whitespace-nowrap " +
        eventChipClasses(event.type)
      }
    >
      {event.label}
    </span>
  );
}

function hasRevision(doc: Document): boolean {
  return doc.timeline.some((e) => e.type === "revision");
}

export default function ProjectDetailClient({
  projectName,
  initialDocuments,
}: {
  projectName: string;
  initialDocuments: Document[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showAddForm, setShowAddForm] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [batchMode, setBatchMode] = useState<BatchMode>(null);
  const [batchDate, setBatchDate] = useState(todayIso());
  const [batchNote, setBatchNote] = useState("");
  const [batchTodos, setBatchTodos] = useState<DraftTodo[]>([
    { tempId: nextTempId(), text: "" },
  ]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<{
    applied: number;
    skipped: { documentId: string; reason: string }[];
  } | null>(null);

  const archivedCount = useMemo(
    () => documents.filter((d) => d.archived).length,
    [documents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = showArchived
      ? documents.filter((d) => d.archived)
      : documents.filter((d) => !d.archived);
    if (!q) return visible;
    return visible.filter((d) => d.documentName.toLowerCase().includes(q));
  }, [documents, showArchived, query]);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => a.documentName.localeCompare(b.documentName)),
    [filtered],
  );

  const visibleIds = useMemo(() => sortedFiltered.map((d) => d.id), [sortedFiltered]);
  const visibleSelected = visibleIds.filter((id) => selectedIds.has(id));
  const allSelected =
    visibleIds.length > 0 && visibleSelected.length === visibleIds.length;
  const someSelected = visibleSelected.length > 0 && !allSelected;

  function toggleAll() {
    const next = new Set(selectedIds);
    if (allSelected) {
      for (const id of visibleIds) next.delete(id);
    } else {
      for (const id of visibleIds) next.add(id);
    }
    setSelectedIds(next);
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function resetBatchForm() {
    setBatchDate(todayIso());
    setBatchNote("");
    setBatchTodos([{ tempId: nextTempId(), text: "" }]);
    setBatchError(null);
    setBatchResult(null);
  }

  function openBatch(mode: BatchMode) {
    resetBatchForm();
    setBatchMode(mode);
  }

  async function onAddDocument(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, documentName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add document");
        return;
      }
      setDocuments((prev) => [...prev, data]);
      setDocumentName("");
      setShowAddForm(false);
      router.refresh();
    } catch {
      setAddError("Failed to connect to server");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function onBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchMode) return;
    setBatchError(null);
    setBatchSubmitting(true);
    setBatchResult(null);
    try {
      const documentIds = Array.from(selectedIds);
      const payload =
        batchMode === "revision"
          ? {
              type: "revision" as const,
              documentIds,
              date: batchDate,
              note: batchNote,
              todos: batchTodos.map((t) => ({ text: t.text })),
            }
          : {
              type: "update" as const,
              documentIds,
              date: batchDate,
              note: batchNote,
            };

      const res = await fetch("/api/documents/batch/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBatchError(data.error ?? "Failed to apply batch");
        return;
      }
      const applied = data.applied as { documentId: string; eventId: string }[];
      const skipped = data.skipped as { documentId: string; reason: string }[];

      if (applied.length === 0) {
        setBatchResult({ applied: 0, skipped });
        return;
      }

      const refreshRes = await fetch("/api/documents", { cache: "no-store" });
      if (refreshRes.ok) {
        const refreshed = (await refreshRes.json()) as Document[];
        const inProject = refreshed.filter((d) => d.projectName === projectName);
        setDocuments(inProject);
      }
      clearSelection();
      setBatchResult({ applied: applied.length, skipped });
      if (skipped.length === 0) {
        setBatchMode(null);
        resetBatchForm();
      }
      router.refresh();
    } catch {
      setBatchError("Failed to connect to server");
    } finally {
      setBatchSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back
        </Link>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
        <h1 className="text-xl font-semibold text-slate-900 mt-0.5">{projectName}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {documents.length} {documents.length === 1 ? "document" : "documents"} total
          {archivedCount > 0 && ` · ${archivedCount} archived`}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <input
          type="search"
          placeholder="Search document..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowArchived((v) => !v);
              clearSelection();
            }}
            className={
              "rounded-lg text-sm font-medium px-3 py-2 border " +
              (showArchived
                ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                : "border-slate-300 text-slate-700 hover:bg-slate-50")
            }
          >
            {showArchived ? "← Active" : `Archived${archivedCount ? ` (${archivedCount})` : ""}`}
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-lg bg-slate-900 text-white text-sm font-medium px-3 py-2 hover:bg-slate-800"
          >
            {showAddForm ? "Cancel" : "+ Add Document"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={onAddDocument}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm"
        >
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Document Name</span>
            <input
              type="text"
              required
              autoFocus
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          <p className="text-xs text-slate-500">
            Will be added to project <span className="font-medium">{projectName}</span>.
          </p>
          {addError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {addError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addSubmitting}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {addSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky top-14 z-10 bg-slate-900 text-white rounded-lg shadow-sm px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => openBatch(batchMode === "revision" ? null : "revision")}
              className="text-sm rounded-md bg-white text-slate-900 px-3 py-1.5 hover:bg-slate-100"
            >
              {batchMode === "revision" ? "Cancel" : "+ Batch Revision"}
            </button>
            <button
              type="button"
              onClick={() => openBatch(batchMode === "update" ? null : "update")}
              className="text-sm rounded-md bg-white text-slate-900 px-3 py-1.5 hover:bg-slate-100"
            >
              {batchMode === "update" ? "Cancel" : "+ Batch Update"}
            </button>
            <button
              type="button"
              onClick={() => {
                clearSelection();
                setBatchMode(null);
              }}
              className="text-sm rounded-md border border-white/40 px-3 py-1.5 hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {batchMode && selectedIds.size > 0 && (
        <form
          onSubmit={onBatchSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm"
        >
          <p className="text-sm font-semibold text-slate-700">
            {batchMode === "revision" ? "Batch Revision" : "Batch Update"} ·{" "}
            {selectedIds.size} {selectedIds.size === 1 ? "document" : "documents"}
          </p>
          {batchMode === "update" && (
            <p className="text-xs text-slate-500">
              Applies to each document&apos;s latest revision. Documents without any revision
              will be skipped. No todos are pre-checked; edit per document afterward if needed.
            </p>
          )}
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">
              {batchMode === "revision" ? "Revision Date" : "Update Date"}
            </span>
            <input
              type="date"
              required
              value={batchDate}
              onChange={(e) => setBatchDate(e.target.value)}
              className="mt-1 w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Note</span>
            <textarea
              rows={3}
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
              placeholder={
                batchMode === "revision"
                  ? "Shared revision context..."
                  : "What was done across selected documents..."
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
          {batchMode === "revision" && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">Todo list</span>
              <p className="text-xs text-slate-500">
                Same todos added to each selected document.
              </p>
              <div className="space-y-2">
                {batchTodos.map((t, idx) => (
                  <div key={t.tempId} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={t.text}
                      onChange={(e) =>
                        setBatchTodos((prev) =>
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
                        setBatchTodos((prev) =>
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
                onClick={() =>
                  setBatchTodos((prev) => [...prev, { tempId: nextTempId(), text: "" }])
                }
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                + Add item
              </button>
            </div>
          )}
          {batchError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {batchError}
            </p>
          )}
          {batchResult && batchResult.skipped.length > 0 && (
            <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="font-medium text-amber-800">
                Applied to {batchResult.applied}. Skipped {batchResult.skipped.length}:
              </p>
              <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
                {batchResult.skipped.map((s) => {
                  const doc = documents.find((d) => d.id === s.documentId);
                  return (
                    <li key={s.documentId}>
                      {doc?.documentName ?? s.documentId} — {s.reason}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={batchSubmitting}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {batchSubmitting
                ? "Applying..."
                : `Apply to ${selectedIds.size} ${selectedIds.size === 1 ? "document" : "documents"}`}
            </button>
          </div>
        </form>
      )}

      {sortedFiltered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          {documents.length === 0
            ? "No documents in this project."
            : showArchived
              ? "No archived documents."
              : "No documents match your search."}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="w-10 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="rounded border-slate-300"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-medium">Document</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th className="px-3 py-2.5 text-left font-medium hidden sm:table-cell">
                  Last Event
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedFiltered.map((doc) => {
                const checked = selectedIds.has(doc.id);
                const last = lastEventInfo(doc);
                const eligibleForUpdate = hasRevision(doc);
                return (
                  <tr
                    key={doc.id}
                    onClick={() => router.push(`/document/${doc.id}`)}
                    className={
                      "hover:bg-slate-50 transition cursor-pointer " +
                      (checked ? "bg-slate-50/60" : "")
                    }
                  >
                    <td
                      className="w-10 px-3 py-3 align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(doc.id)}
                        className="rounded border-slate-300"
                        aria-label={`Select ${doc.documentName}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{doc.documentName}</div>
                      <div className="flex items-center gap-1.5 mt-1 sm:hidden">
                        {last ? (
                          <>
                            <EventChip event={last} />
                            <span className="text-xs text-slate-500">{last.date}</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">No events</span>
                        )}
                      </div>
                      {!eligibleForUpdate && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          (no revision yet)
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={
                            "text-xs font-medium rounded-full border px-2 py-0.5 whitespace-nowrap " +
                            (doc.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200")
                          }
                        >
                          {doc.status === "completed" ? "Completed" : "In Progress"}
                        </span>
                        {doc.archived && (
                          <span className="text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 whitespace-nowrap">
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      {last ? (
                        <div className="flex items-center gap-2">
                          <EventChip event={last} />
                          <span className="text-xs text-slate-500">{last.date}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

