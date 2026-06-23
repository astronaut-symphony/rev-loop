import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import ProjectListClient from "./components/ProjectListClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireSession();
  const db = await readDb();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full">
      <ProjectListClient initialDocuments={db.documents} />
    </main>
  );
}
