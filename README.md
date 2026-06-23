# rev-loop

A lightweight document review-loop tracker. Submission → Revision → Update, until done.

Per-project dashboard for tracking document revision cycles. Each document has a timeline:
- **Submission** (initial, one-time) — when the document was first submitted to a reviewer
- **Revision** — reviewer feedback with a todo list of items to address
- **Update** — author's response, references a revision, checks off addressed todos

Plus: status (In Progress / Completed), archive, batch revision/update across documents, and a global activity log.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Vercel Blob (private access) — single JSON file as the DB
- JWT session via `jose`, stored in an httpOnly cookie

## Setup (local)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in:

   ```
   BLOB_READ_WRITE_TOKEN=...   # from Vercel Blob dashboard
   SESSION_SECRET=...           # random 32+ chars
   USERS=alice:pass1,bob:pass2,charlie:pass3
   ```

   Generate `SESSION_SECRET`:

   ```bash
   # macOS/Linux
   openssl rand -base64 32

   # Windows PowerShell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

3. Run dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Deploy to Vercel

1. Push to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new). Next.js is auto-detected.
3. In the Vercel project dashboard → **Storage** → **Create Database** → **Blob**. Vercel auto-sets `BLOB_READ_WRITE_TOKEN`.

   For production safety, create a **separate** blob store for prod and connect it to the **Production** environment only. Keep your dev store connected to local `.env.local` so the two never collide.

4. Add the remaining env vars in Vercel:
   - `SESSION_SECRET`
   - `USERS`

5. Deploy.

## Data model

Stored in Vercel Blob as a single file `data/documents.json`:

```jsonc
{
  "documents": [
    {
      "id": "uuid",
      "projectName": "Project A",
      "documentName": "Spec API v2",
      "status": "in_progress",          // or "completed"
      "archived": false,
      "createdBy": "alice",
      "createdAt": "2026-06-22T...",
      "timeline": [
        {
          "id": "uuid",
          "type": "submission",           // or "revision" | "update"
          "date": "2026-06-22",
          "note": "...",
          "addedBy": "alice",
          "addedAt": "2026-06-22T..."
        },
        {
          "id": "uuid",
          "type": "revision",
          "date": "2026-06-25",
          "note": "...",
          "todos": [{ "id": "uuid", "text": "fix endpoint /users" }],
          "addedBy": "bob",
          "addedAt": "2026-06-25T..."
        },
        {
          "id": "uuid",
          "type": "update",
          "date": "2026-06-28",
          "note": "...",
          "revisionId": "uuid-of-revision",
          "checkedTodoIds": ["uuid-of-todo"],
          "addedBy": "alice",
          "addedAt": "2026-06-28T..."
        }
      ]
    }
  ],
  "activities": [
    {
      "id": "uuid",
      "timestamp": "2026-06-22T...",
      "actor": "alice",
      "kind": "document_created",
      "docId": "uuid",
      "documentName": "Spec API v2",
      "projectName": "Project A"
    }
  ]
}
```

Legacy data with the old schema (Indonesian field names, no `timeline`/`activities`) is auto-migrated on read.

## Notes

- Storage is last-write-wins. Concurrent edits from multiple users can overwrite each other — fine for a small internal team.
- User passwords sit in an env var in plaintext. Vercel env vars are encrypted at rest, so this is acceptable for low-stakes internal use. For anything sensitive, swap to bcrypt-hashed credentials.
- Deletes are real deletes. Removed documents and events are gone from the DB — the activity log keeps a record (with name snapshot) but the underlying objects are not recoverable.
