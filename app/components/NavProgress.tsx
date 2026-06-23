"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setActive(true);
    const hide = setTimeout(() => setActive(false), 500);
    return () => clearTimeout(hide);
  }, [pathname, searchParams]);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-0.5 z-[60] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className={
          "h-full bg-slate-900 origin-left transition-transform duration-500 ease-out " +
          (active ? "scale-x-100" : "scale-x-0")
        }
      />
    </div>
  );
}
