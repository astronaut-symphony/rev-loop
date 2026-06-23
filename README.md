# Dashboard Monitoring Revisi Dokumen

Dashboard web-based untuk monitoring revisi dokumen per project. Login simple untuk 3 user, data tersimpan di Vercel Blob sebagai single JSON file.

## Fitur

- Login pakai username/password (3 user, di-config via env var)
- Tambah dokumen dengan metadata: nama project + nama dokumen
- Track revisi per dokumen: tanggal revisi, tanggal kirim, note
- Timeline view per dokumen
- Search & group by project di dashboard

## Tech Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Vercel Blob (storage)
- JWT session (jose) di httpOnly cookie

## Setup Local

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` ke `.env.local` dan isi:

   ```
   BLOB_READ_WRITE_TOKEN=...        # dari Vercel Blob dashboard
   SESSION_SECRET=...                # random 32+ chars
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

   Buka http://localhost:3000

## Deploy ke Vercel

1. Push repo ini ke GitHub.

2. Import project di [vercel.com](https://vercel.com/new). Next.js auto-detected.

3. Di Vercel project dashboard → **Storage** → **Create Database** → pilih **Blob**. Vercel akan auto-set `BLOB_READ_WRITE_TOKEN` di Environment Variables.

4. Tambah environment variables manual:
   - `SESSION_SECRET` — random string min 32 chars
   - `USERS` — format: `user1:pass1,user2:pass2,user3:pass3`

5. Deploy. Selesai.

## Struktur Data

Tersimpan di Vercel Blob sebagai single file `data/documents.json`:

```json
{
  "documents": [
    {
      "id": "uuid",
      "projectName": "Project A",
      "documentName": "Spec API v2",
      "createdBy": "alice",
      "createdAt": "2026-06-22T...",
      "revisions": [
        {
          "id": "uuid",
          "tanggalRevisi": "2026-06-20",
          "tanggalKirim": "2026-06-22",
          "note": "Update endpoint /users",
          "addedBy": "alice",
          "addedAt": "2026-06-22T..."
        }
      ]
    }
  ]
}
```

## Catatan

- Storage pakai last-write-wins. Kalau 2 user edit bersamaan, perubahan terakhir yang dipakai. Untuk 3 user dengan akses jarang bareng, ini fine.
- Password di env var disimpan plaintext. Karena Vercel env vars sudah encrypted at rest dan cuma kamu yang akses, ini ok untuk use case internal kecil. Kalau mau lebih aman, ganti dengan bcrypt hash.
- File JSON di-overwrite tiap save. Vercel Blob meng-handle versioning, tapi tidak ada UI rollback bawaan di app ini.
