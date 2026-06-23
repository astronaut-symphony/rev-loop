import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import TopBar from "@/app/components/TopBar";
import DocumentDetailClient from "@/app/components/DocumentDetailClient";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) notFound();

  return (
    <>
      <TopBar username={session.username} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <DocumentDetailClient initialDocument={doc} />
      </main>
    </>
  );
}
