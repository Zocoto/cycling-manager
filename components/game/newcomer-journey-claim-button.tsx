"use client";

import { useFormStatus } from "react-dom";

export function NewcomerJourneyClaimButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#176951] px-3 text-[10px] font-black text-white shadow-sm transition hover:bg-[#0B493C] disabled:cursor-wait disabled:opacity-65"
    >
      {pending ? "Récupération…" : "Récupérer"}
    </button>
  );
}
