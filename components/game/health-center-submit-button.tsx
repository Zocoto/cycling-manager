"use client";

import { useFormStatus } from "react-dom";

export function HealthCenterSubmitButton({
  children,
  pendingLabel,
  disabled = false,
  tone = "gold",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  tone?: "gold" | "green";
}) {
  const { pending } = useFormStatus();
  const colors =
    tone === "green"
      ? "bg-[#176951] text-white hover:bg-[#0B4A3B]"
      : "bg-[#F2C94C] text-[#071A17] hover:bg-[#F7D96C]";

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-45 ${colors}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
