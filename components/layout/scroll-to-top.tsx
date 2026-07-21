"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Jumps back to the top of the page on every navigation, instantly (no smooth
 * gliding animation). Works together with the app `Link` wrapper, which
 * disables Next.js' own scroll handling so this is the single source of truth.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant" as ScrollBehavior,
    });
  }, [pathname]);

  return null;
}
