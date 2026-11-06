"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

const getServerSnapshot = () => true;

export function DraftBannerLifetime({ expiresAt, children }: { expiresAt: number; children: ReactNode }) {
  const getSnapshot = useCallback(() => Date.now() < expiresAt, [expiresAt]);
  const subscribe = useCallback((onChange: () => void) => {
    const timer = window.setTimeout(onChange, Math.max(0, expiresAt - Date.now()));
    function checkWhenVisible() {
      if (!document.hidden && Date.now() >= expiresAt) onChange();
    }
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [expiresAt]);
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return visible ? children : null;
}
