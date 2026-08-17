"use client";

import { useFormStatus } from "react-dom";

export function NationalChampionshipSelectionSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#176951] px-5 text-sm font-black text-white shadow-lg shadow-[#176951]/15 transition hover:bg-[#0B302B] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Enregistrement…" : "Enregistrer les inscriptions"}
    </button>
  );
}
