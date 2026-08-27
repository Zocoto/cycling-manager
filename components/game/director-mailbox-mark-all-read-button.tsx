"use client";

import { useTransition } from "react";

import { markAllDirectorMessagesReadAction } from "@/app/jeu/messagerie/actions";
import { notifyDirectorMailboxChanged } from "@/lib/game/director-mailbox-sync";

export function DirectorMailboxMarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending || undefined}
      className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-65"
      onClick={() => {
        if (isPending) return;

        startTransition(async () => {
          await markAllDirectorMessagesReadAction();
          notifyDirectorMailboxChanged(0);
        });
      }}
    >
      {isPending ? "Mise à jour…" : "Tout marquer comme lu"}
    </button>
  );
}
