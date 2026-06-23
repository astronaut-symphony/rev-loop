import { requireSession } from "@/lib/auth";
import { readDb } from "@/lib/blob";
import LogClient from "@/app/components/LogClient";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  await requireSession();
  const db = await readDb();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full">
      <LogClient activities={db.activities} />
    </main>
  );
}
