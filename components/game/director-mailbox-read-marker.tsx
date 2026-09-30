"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { markDirectorMessageRead } from "@/lib/game/director-mailbox-client";

export function DirectorMailboxReadMarker({
  messageId,
}: {
  messageId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!messageId) return;

    let active = true;

    void markDirectorMessageRead(messageId).then((marked) => {
      if (active && marked) router.refresh();
    });

    return () => {
      active = false;
    };
  }, [messageId, router]);

  return null;
}
