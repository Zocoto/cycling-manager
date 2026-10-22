"use client";

import { useActionState } from "react";
import { ignoreNaturalizationAlertAction } from "@/app/jeu/naturalization-alert-actions";
import type { DashboardAssistantLine } from "@/lib/game/dashboard-assistant";

export function DashboardNaturalizationIgnore({ target }: {
  target: NonNullable<DashboardAssistantLine["naturalizationTarget"]>;
}) {
  const [state, action, pending] = useActionState(ignoreNaturalizationAlertAction.bind(null, target), { error: null });
  return (
    <form action={action} className="shrink-0 pr-1">
      <button type="submit" disabled={pending}
        aria-label="Ignorer cette alerte de naturalisation"
        title="Masquer cette alerte sans empêcher une naturalisation manuelle."
        className="min-h-9 rounded-lg px-2 text-[10px] font-bold text-[#6B8179] transition hover:bg-white hover:text-[#173D35] disabled:cursor-wait disabled:opacity-50">
        {pending ? "…" : "Ignorer"}
      </button>
      {state.error ? <p role="alert" className="max-w-36 text-[10px] text-[#B62D39]">{state.error}</p> : null}
    </form>
  );
}
