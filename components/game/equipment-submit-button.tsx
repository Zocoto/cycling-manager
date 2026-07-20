"use client";

import { useFormStatus } from "react-dom";

export function EquipmentSubmitButton({
  mode,
  disabled = false,
}: {
  mode: "purchase" | "equip";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={
        mode === "purchase"
          ? "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] disabled:cursor-not-allowed disabled:bg-[#D4D8CE] disabled:text-[#60756E]"
          : "inline-flex min-h-9 items-center justify-center rounded-lg bg-[#42B99A] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#07302A] transition hover:bg-[#6DD1B4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BE0BC] disabled:cursor-wait disabled:opacity-60"
      }
    >
      {pending
        ? mode === "purchase"
          ? "Achat en cours…"
          : "Attribution…"
        : mode === "purchase"
          ? disabled
            ? "Trésorerie insuffisante"
            : "Acheter cette référence"
          : "Équiper"}
    </button>
  );
}
