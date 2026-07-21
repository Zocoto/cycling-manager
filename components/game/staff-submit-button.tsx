"use client";

import { useFormStatus } from "react-dom";

export function StaffSubmitButton({
  children,
  pendingLabel = "Recrutement…",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#176951] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#B8C8C2] disabled:text-[#60756E]"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
