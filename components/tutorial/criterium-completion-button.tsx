"use client";

import { useFormStatus } from "react-dom";

export function CriteriumCompletionButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-6 text-sm font-black text-[#071A17] shadow-md transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      {pending
        ? "Validation…"
        : "Terminer la formation pratique"}
    </button>
  );
}
