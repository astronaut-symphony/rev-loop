import Link from "next/link";

const GITHUB_USERNAME = "astronaut-symphony";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="border-t border-slate-200" />
        <div className="py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-2xl font-semibold tracking-wide text-slate-900">
              REV LOOP
            </p>
            <p className="text-sm text-slate-500 mt-2 inline-flex items-center gap-1.5">
              created by
              <a
                href={`https://github.com/${GITHUB_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                @{GITHUB_USERNAME}
              </a>
            </p>
          </div>

          <Link
            href="/log"
            className="text-sm text-slate-700 hover:text-slate-900 sm:self-start sm:mt-2"
          >
            Activity Log
          </Link>
        </div>

        <div className="border-t border-slate-200" />
        <div className="py-6 text-center text-xs text-slate-500">
          &copy; {year} REV LOOP
        </div>
      </div>
    </footer>
  );
}
