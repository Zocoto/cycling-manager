"use client";

import { useFormStatus } from "react-dom";

export function EquipmentPartnerSubmitButton({
  label,
  pendingLabel,
  disabled = false,
  tone = "gold",
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  tone?: "gold" | "green";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={
        tone === "green"
          ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#42B99A] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#07251F] transition hover:bg-[#72D2B7] disabled:cursor-not-allowed disabled:bg-[#CBD8D2] disabled:text-[#61736B]"
          : "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#071A17] transition hover:bg-[#FFD968] disabled:cursor-not-allowed disabled:bg-[#D4D8CE] disabled:text-[#60756E]"
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
