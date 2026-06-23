import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import TopBar from "@/app/components/TopBar";
import ProjectDetailClient from "@/app/components/ProjectDetailClient";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const session = await requireSession();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const db = await readDb();
  const documents = db.documents.filter((d) => d.projectName === projectName);
  if (documents.length === 0) notFound();

  return (
    <>
      <TopBar username={session.username} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <ProjectDetailClient projectName={projectName} initialDocuments={documents} />
      </main>
    </>
  );
}
