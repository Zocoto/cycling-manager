"use client";

import { useFormStatus } from "react-dom";

export function TransferSubmitButton({
  children,
  pendingLabel,
  disabled = false,
  tone = "gold",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  tone?: "gold" | "green" | "dark";
}) {
  const { pending } = useFormStatus();
  const colors = tone === "gold"
    ? "bg-[#F2C94C] text-[#071A17] hover:bg-[#FFD968]"
    : tone === "green"
      ? "bg-[#42B99A] text-[#07302A] hover:bg-[#69D4B5]"
      : "bg-[#0B302B] text-white hover:bg-[#176951]";

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A] disabled:cursor-not-allowed disabled:bg-[#D4D8CE] disabled:text-[#60756E] ${colors}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
