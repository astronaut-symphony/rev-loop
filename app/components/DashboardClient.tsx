"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Document } from "@/lib/types";

function lastRevisionLabel(doc: Document): string {
  if (doc.revisions.length === 0) return "Belum ada revisi";
  const last = doc.revisions[doc.revisions.length - 1];
  return `Revisi terakhir: ${last.tanggalRevisi}`;
}

export default function DashboardClient({ initialDocuments }: { initialDocuments: Document[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.projectName.toLowerCase().includes(q) ||
        d.documentName.toLowerCase().includes(q),
    );
  }, [documents, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Document[]>();
    for (const d of filtered) {
      const key = d.projectName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

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
        setError(data.error ?? "Gagal menambah dokumen");
        return;
      }
      setDocuments((prev) => [...prev, data]);
      setProjectName("");
      setDocumentName("");
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <input
          type="search"
          placeholder="Cari project atau dokumen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 text-white text-sm font-medium px-3 py-2 hover:bg-slate-800"
        >
          {showForm ? "Batal" : "+ Tambah Dokumen"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nama Project</span>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nama Dokumen</span>
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
              {submitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}

      {grouped.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          Belum ada dokumen. Klik <span className="font-medium">+ Tambah Dokumen</span> untuk mulai.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([project, docs]) => (
            <section key={project}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {project}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/document/${doc.id}`}
                    className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-400 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-slate-900">{doc.documentName}</h3>
                      <span className="text-xs rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 whitespace-nowrap">
                        {doc.revisions.length} revisi
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{lastRevisionLabel(doc)}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
