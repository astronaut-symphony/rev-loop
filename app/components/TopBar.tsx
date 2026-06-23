"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TopBar({ username }: { username: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="font-semibold tracking-wide text-slate-900 hover:text-slate-700"
        >
          REV LOOP
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600 hidden sm:inline">{username}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
