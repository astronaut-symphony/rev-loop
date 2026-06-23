import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import TopBar from "./components/TopBar";
import ProjectListClient from "./components/ProjectListClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();
  const db = await readDb();

  return (
    <>
      <TopBar username={session.username} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <ProjectListClient initialDocuments={db.documents} />
      </main>
    </>
  );
}
