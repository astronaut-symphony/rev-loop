import { put, list } from "@vercel/blob";
import type { Database } from "./types";

const BLOB_PATHNAME = "data/documents.json";

const emptyDb = (): Database => ({ documents: [] });

export async function readDb(): Promise<Database> {
  try {
    const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
    const blob = blobs.find((b) => b.pathname === BLOB_PATHNAME);
    if (!blob) return emptyDb();
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return emptyDb();
    const data = (await res.json()) as Database;
    if (!data || !Array.isArray(data.documents)) return emptyDb();
    return data;
  } catch {
    return emptyDb();
  }
}

export async function writeDb(db: Database): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(db, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
  });
}
