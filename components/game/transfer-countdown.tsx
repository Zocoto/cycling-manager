"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function TransferCountdown({ closesAt }: { closesAt: string }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() => getRemaining(closesAt));

  useEffect(() => {
    let refreshed = false;
    const interval = window.setInterval(() => {
      const next = getRemaining(closesAt);
      setRemaining(next);
      if (next.total <= 0 && !refreshed) {
        refreshed = true;
        window.clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [closesAt, router]);

  if (remaining.total <= 0) return <span>Clôture en cours…</span>;
  return (
    <span suppressHydrationWarning>
      {remaining.hours > 0 ? `${remaining.hours} h ` : ""}
      {String(remaining.minutes).padStart(2, "0")} min {String(remaining.seconds).padStart(2, "0")} s
    </span>
  );
}

function getRemaining(closesAt: string) {
  const total = Math.max(0, new Date(closesAt).getTime() - Date.now());
  return {
    total,
    hours: Math.floor(total / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
  };
}
