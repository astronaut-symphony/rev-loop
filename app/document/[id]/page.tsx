import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import DocumentDetailClient from "@/app/components/DocumentDetailClient";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full">
      <DocumentDetailClient initialDocument={doc} />
    </main>
  );
}
