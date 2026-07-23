"use client";

import { useFormStatus } from "react-dom";

export function InventoryUseSubmitButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#176951] px-4 text-sm font-black text-white transition hover:bg-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#AEBBB6]"
    >
      {pending ? "Attribution…" : "Utiliser sur ce coureur"}
      {!pending ? <span aria-hidden="true">→</span> : null}
    </button>
  );
}
