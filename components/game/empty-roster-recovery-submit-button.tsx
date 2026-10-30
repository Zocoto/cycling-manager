"use client";

import { useFormStatus } from "react-dom";

export function EmptyRosterRecoverySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="min-h-11 rounded-xl bg-[#176951] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#11523F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176951] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Création des 7 coureurs…" : "Relancer mon effectif · 7 coureurs"}
    </button>
  );
}
