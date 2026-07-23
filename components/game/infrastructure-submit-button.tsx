"use client";

import { useFormStatus } from "react-dom";

export function InfrastructureSubmitButton({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-xs font-black uppercase tracking-[0.13em] text-[#071A17] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#C9D1CD] disabled:text-[#60756E]"
    >
      {pending ? "Lancement du chantier…" : children}
    </button>
  );
}
