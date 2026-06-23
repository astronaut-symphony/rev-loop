import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import ProjectDetailClient from "@/app/components/ProjectDetailClient";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  await requireSession();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const db = await readDb();
  const documents = db.documents.filter((d) => d.projectName === projectName);
  if (documents.length === 0) notFound();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full">
      <ProjectDetailClient projectName={projectName} initialDocuments={documents} />
    </main>
  );
}
