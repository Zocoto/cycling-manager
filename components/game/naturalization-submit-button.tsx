"use client";

import { useFormStatus } from "react-dom";

export function NaturalizationSubmitButton({
  subjectName,
  targetCountryName,
  compact = false,
}: {
  subjectName: string;
  targetCountryName: string;
  compact?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (
          !window.confirm(
            `Confirmer la naturalisation de ${subjectName} pour ${targetCountryName} ? Sa nationalité sportive sera modifiée immédiatement.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className={`w-full rounded-xl bg-[#F2C94C] font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] disabled:cursor-wait disabled:opacity-65 ${
        compact ? "px-3 py-2.5 text-[9px]" : "px-4 py-3 text-[10px]"
      }`}
    >
      {pending ? "Naturalisation…" : `Naturaliser pour ${targetCountryName}`}
    </button>
  );
}
