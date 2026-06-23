import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import TopBar from "./components/TopBar";
import Footer from "./components/Footer";
import NavProgress from "./components/NavProgress";

export const metadata: Metadata = {
  title: "REV LOOP",
  description:
    "Document review-loop tracker — Submission → Revision → Update, until done.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {session && <TopBar username={session.username} />}
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
