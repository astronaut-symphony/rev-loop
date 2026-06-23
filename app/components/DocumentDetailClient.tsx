"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Document, Revision } from "@/lib/types";

function formatDate(iso: string): string {
  if (!iso) return "-";
  return iso;
}

export default function DocumentDetailClient({ initialDocument }: { initialDocument: Document }) {
  const router = useRouter();
  const [doc, setDoc] = useState<Document>(initialDocument);
  const [showForm, setShowForm] = useState(false);
  const [tanggalRevisi, setTanggalRevisi] = useState("");
  const [tanggalKirim, setTanggalKirim] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...doc.revisions].sort((a, b) =>
    a.tanggalRevisi.localeCompare(b.tanggalRevisi),
  );

  async function onAddRevision(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggalRevisi, tanggalKirim, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah revisi");
        return;
      }
      const rev = data as Revision;
      setDoc({ ...doc, revisions: [...doc.revisions, rev] });
      setTanggalRevisi("");
      setTanggalKirim("");
      setNote("");
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteRevision(revId: string) {
    if (!confirm("Hapus revisi ini?")) return;
    const res = await fetch(`/api/documents/${doc.id}/revisions/${revId}`, { method: "DELETE" });
    if (res.ok) {
      setDoc({ ...doc, revisions: doc.revisions.filter((r) => r.id !== revId) });
      router.refresh();
    }
  }

  async function onDeleteDocument() {
    if (!confirm(`Hapus dokumen "${doc.documentName}" beserta semua revisinya?`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Kembali ke dashboard
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{doc.projectName}</p>
            <h1 className="text-xl font-semibold text-slate-900 mt-0.5">{doc.documentName}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Dibuat oleh {doc.createdBy} &middot; {doc.createdAt.slice(0, 10)}
            </p>
          </div>
          <button
            onClick={onDeleteDocument}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Hapus dokumen
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Timeline Revisi ({doc.revisions.length})
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 text-white text-sm font-medium px-3 py-2 hover:bg-slate-800"
        >
          {showForm ? "Batal" : "+ Tambah Revisi"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onAddRevision}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tanggal Revisi</span>
              <input
                type="date"
                required
                value={tanggalRevisi}
                onChange={(e) => setTanggalRevisi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tanggal Kirim</span>
              <input
                type="date"
                required
                value={tanggalKirim}
                onChange={(e) => setTanggalKirim(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Note Revisi</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan revisi..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </label>
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

      {sorted.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          Belum ada revisi.
        </div>
      ) : (
        <ol className="relative border-l-2 border-slate-200 ml-3 space-y-4">
          {sorted.map((rev, idx) => (
            <li key={rev.id} className="ml-6">
              <span className="absolute -left-[9px] mt-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-white" />
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Revisi #{idx + 1}
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                      <div>
                        <span className="text-slate-500">Tgl Revisi:</span>{" "}
                        <span className="font-medium">{formatDate(rev.tanggalRevisi)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Tgl Kirim:</span>{" "}
                        <span className="font-medium">{formatDate(rev.tanggalKirim)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteRevision(rev.id)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Hapus
                  </button>
                </div>
                {rev.note && (
                  <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{rev.note}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  oleh {rev.addedBy} &middot; {rev.addedAt.slice(0, 10)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
