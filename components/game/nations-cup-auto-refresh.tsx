"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

const REFRESH_INTERVAL_MS = 30_000;

export function NationsCupAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled, router]);

  return null;
}
