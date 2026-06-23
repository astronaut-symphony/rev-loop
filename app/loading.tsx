export default function Loading() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full">
      <div className="flex items-center justify-center py-24">
        <div
          role="status"
          aria-label="Loading"
          className="inline-flex items-center gap-3 text-slate-500 text-sm"
        >
          <span className="inline-block w-5 h-5 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    </main>
  );
}
