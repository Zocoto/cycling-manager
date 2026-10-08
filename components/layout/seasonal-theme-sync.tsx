"use client";

import { useEffect } from "react";
import { getActiveSiteTheme, HALLOWEEN_SITE_THEME, nextSiteThemeCheckDelay } from "@/lib/site-theme";

/** Also refreshes an already-open tab at midnight; no profile preference or database write. */
export function SeasonalThemeSync() {
  useEffect(() => {
    if (!HALLOWEEN_SITE_THEME.enabled || !HALLOWEEN_SITE_THEME.window) return;
    let timer: ReturnType<typeof setTimeout>;
    function sync() {
      clearTimeout(timer);
      const now = new Date();
      const theme = getActiveSiteTheme(now);
      if (theme) document.documentElement.dataset.siteTheme = theme;
      else delete document.documentElement.dataset.siteTheme;
      timer = setTimeout(sync, nextSiteThemeCheckDelay(now));
    }
    function onVisible() { if (!document.hidden) sync(); }
    sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return null;
}
