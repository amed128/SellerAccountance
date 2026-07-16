"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavMenu({
  children,
  openLabel,
  closeLabel,
}: {
  children: React.ReactNode;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The nav lives in the persistent root layout, so it isn't remounted on
  // navigation — close the panel explicitly once a link has been followed.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-2.5 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav-links"
        aria-label={open ? closeLabel : openLabel}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:text-blue-600 sm:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          {open ? <path d="M4 4 L14 14 M14 4 L4 14" /> : <path d="M2 4.5 H16 M2 9 H16 M2 13.5 H16" />}
        </svg>
      </button>

      <div
        id="mobile-nav-links"
        className={`${open ? "mt-3 flex" : "hidden"} flex-col items-start gap-3 sm:mt-0 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-5`}
      >
        {children}
      </div>
    </div>
  );
}
