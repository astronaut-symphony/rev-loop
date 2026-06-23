import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import TopBar from "@/app/components/TopBar";
import type { Activity, ActivityKind } from "@/lib/types";

export const dynamic = "force-dynamic";

function chipClasses(kind: ActivityKind, activity: Activity): string {
  switch (kind) {
    case "login":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "logout":
      return "bg-slate-100 text-slate-500 border-slate-200";
    case "document_created":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "document_deleted":
      return "bg-red-50 text-red-700 border-red-200";
    case "event_added":
    case "batch_added":
      if (activity.eventType === "submission")
        return "bg-sky-50 text-sky-700 border-sky-200";
      if (activity.eventType === "revision")
        return "bg-amber-50 text-amber-700 border-amber-200";
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "event_deleted":
      return "bg-red-50 text-red-700 border-red-200";
    case "status_changed":
      return activity.toStatus === "completed"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
    case "archive_changed":
      return activity.archived
        ? "bg-slate-100 text-slate-600 border-slate-200"
        : "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function chipLabel(kind: ActivityKind, activity: Activity): string {
  switch (kind) {
    case "login":
      return "Login";
    case "logout":
      return "Logout";
    case "document_created":
      return "Created";
    case "document_deleted":
      return "Deleted";
    case "event_added":
      if (activity.eventType === "submission") return "Submission";
      if (activity.eventType === "revision") return "Revision";
      return "Update";
    case "event_deleted":
      return "Event removed";
    case "batch_added":
      return activity.eventType === "revision" ? "Batch Revision" : "Batch Update";
    case "status_changed":
      return activity.toStatus === "completed" ? "Completed" : "Reopened";
    case "archive_changed":
      return activity.archived ? "Archived" : "Unarchived";
  }
}

function describe(activity: Activity): React.ReactNode {
  const actor = <span className="font-medium">{activity.actor}</span>;
  const doc = activity.documentName ? (
    <span className="font-medium text-slate-900">{activity.documentName}</span>
  ) : null;
  const project = activity.projectName ? (
    <span className="text-slate-400"> · {activity.projectName}</span>
  ) : null;

  switch (activity.kind) {
    case "login":
      return <>{actor} signed in</>;
    case "logout":
      return <>{actor} signed out</>;
    case "document_created":
      return (
        <>
          {actor} created document {doc}
          {project}
        </>
      );
    case "document_deleted":
      return (
        <>
          {actor} deleted document {doc}
          {project}
        </>
      );
    case "event_added":
      return (
        <>
          {actor} added {activity.eventLabel ?? "event"} in {doc}
          {project}
        </>
      );
    case "event_deleted":
      return (
        <>
          {actor} removed {activity.eventLabel ?? "event"} from {doc}
          {project}
        </>
      );
    case "batch_added":
      return (
        <>
          {actor} applied {activity.eventLabel} to {activity.batchCount}{" "}
          {activity.batchCount === 1 ? "document" : "documents"}
        </>
      );
    case "status_changed":
      return (
        <>
          {actor}{" "}
          {activity.toStatus === "completed"
            ? "marked as Complete"
            : "reopened"}{" "}
          {doc}
          {project}
        </>
      );
    case "archive_changed":
      return (
        <>
          {actor} {activity.archived ? "archived" : "unarchived"} {doc}
          {project}
        </>
      );
  }
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

export default async function LogPage() {
  const session = await requireSession();
  const db = await readDb();

  const entries = [...db.activities].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );

  let lastDate = "";

  return (
    <>
      <TopBar username={session.username} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-6">
          <div>
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
              &larr; Back
            </Link>
          </div>

          <div>
            <h1 className="text-xl font-semibold text-slate-900">Activity Log</h1>
            <p className="text-xs text-slate-500 mt-1">
              {entries.length} {entries.length === 1 ? "action" : "actions"} recorded
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
              No activity yet.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <ul className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const { date, time } = formatTimestamp(entry.timestamp);
                  const showDateHeader = date !== lastDate;
                  lastDate = date;
                  const inner = (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="text-xs text-slate-400 mt-0.5 tabular-nums whitespace-nowrap w-12">
                        {time}
                      </span>
                      <span
                        className={
                          "text-xs font-medium rounded-full border px-2 py-0.5 mt-0.5 whitespace-nowrap " +
                          chipClasses(entry.kind, entry)
                        }
                      >
                        {chipLabel(entry.kind, entry)}
                      </span>
                      <span className="flex-1 text-sm text-slate-700 min-w-0">
                        {describe(entry)}
                      </span>
                    </div>
                  );
                  return (
                    <li key={entry.id}>
                      {showDateHeader && (
                        <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {date}
                        </div>
                      )}
                      {entry.docId && entry.kind !== "document_deleted" ? (
                        <Link
                          href={`/document/${entry.docId}`}
                          className="block hover:bg-slate-50"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
