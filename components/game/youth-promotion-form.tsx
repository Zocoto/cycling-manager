"use client";

import { useActionState } from "react";

import {
  recruitYouthRiderInlineAction,
  type RecruitYouthRiderActionState,
} from "@/app/jeu/centre-de-formation/actions";

const INITIAL_STATE: RecruitYouthRiderActionState = {
  status: "idle",
  message: "",
  promotionGameYear: null,
};

export function YouthPromotionForm({
  academyRiderId,
  nextGameYear,
}: {
  academyRiderId: string;
  nextGameYear: number;
}) {
  const [state, action, pending] = useActionState(
    recruitYouthRiderInlineAction,
    INITIAL_STATE,
  );

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-xl bg-[#F2C94C]/20 px-3 py-2.5 text-xs font-black text-[#8A6B16]"
      >
        Passage pro la saison prochaine · {state.promotionGameYear}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="academyRiderId" value={academyRiderId} />
      <button
        type="submit"
        disabled={pending}
        aria-describedby={state.status === "error" ? `promotion-error-${academyRiderId}` : undefined}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F2C94C] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:bg-[#E9BE32] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#071A17]/25 border-t-[#071A17]"
          />
        ) : null}
        {pending ? "Signature en cours…" : `Recruter pour la saison ${nextGameYear}`}
      </button>
      {state.status === "error" ? (
        <p
          id={`promotion-error-${academyRiderId}`}
          role="alert"
          className="rounded-lg bg-[#FFF0EE] px-3 py-2 text-[10px] font-bold text-[#8A2F2F]"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
