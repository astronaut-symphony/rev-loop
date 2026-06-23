"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Document } from "@/lib/types";

type ProjectSummary = {
  name: string;
  total: number;
  inProgress: number;
  completed: number;
  archived: number;
  lastActivity: string | null;
};

function lastActivityIso(docs: Document[]): string | null {
  let latest: string | null = null;
  for (const d of docs) {
    const candidates = [d.createdAt, ...d.timeline.map((e) => e.addedAt)];
    for (const c of candidates) {
      if (!latest || c.localeCompare(latest) > 0) latest = c;
    }
  }
  return latest;
}

export default function ProjectListClient({
  initialDocuments,
}: {
  initialDocuments: Document[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projects = useMemo<ProjectSummary[]>(() => {
    const map = new Map<string, Document[]>();
    for (const d of documents) {
      if (!map.has(d.projectName)) map.set(d.projectName, []);
      map.get(d.projectName)!.push(d);
    }
    return Array.from(map.entries())
      .map(([name, docs]) => ({
        name,
        total: docs.length,
        inProgress: docs.filter((d) => !d.archived && d.status === "in_progress").length,
        completed: docs.filter((d) => !d.archived && d.status === "completed").length,
        archived: docs.filter((d) => d.archived).length,
        lastActivity: lastActivityIso(docs),
      }))
      .sort((a, b) => {
        if (a.lastActivity && b.lastActivity) {
          return b.lastActivity.localeCompare(a.lastActivity);
        }
        if (a.lastActivity) return -1;
        if (b.lastActivity) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const knownProjects = useMemo(
    () => Array.from(new Set(documents.map((d) => d.projectName))).sort(),
    [documents],
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, documentName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add document");
        return;
      }
      setDocuments((prev) => [...prev, data]);
      setProjectName("");
      setDocumentName("");
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <input
          type="search"
          placeholder="Search project..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 text-white text-sm font-medium px-3 py-2 hover:bg-slate-800"
        >
          {showForm ? "Cancel" : "+ Add Document"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Project Name</span>
              <input
                type="text"
                required
                list="known-projects"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
              <datalist id="known-projects">
                {knownProjects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Document Name</span>
              <input
                type="text"
                required
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </label>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          {projects.length === 0 ? (
            <>
              No projects yet. Click <span className="font-medium">+ Add Document</span> to start.
            </>
          ) : (
            <>No projects match your search.</>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <Link
              key={p.name}
              href={`/project/${encodeURIComponent(p.name)}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-400 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-900 truncate">{p.name}</h3>
                <span className="text-xs rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 whitespace-nowrap">
                  {p.total} {p.total === 1 ? "doc" : "docs"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.inProgress > 0 && (
                  <span className="text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5">
                    {p.inProgress} in progress
                  </span>
                )}
                {p.completed > 0 && (
                  <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
                    {p.completed} completed
                  </span>
                )}
                {p.archived > 0 && (
                  <span className="text-xs rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5">
                    {p.archived} archived
                  </span>
                )}
              </div>
              {p.lastActivity && (
                <p className="text-xs text-slate-400 mt-3">
                  Last activity: {p.lastActivity.slice(0, 10)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
