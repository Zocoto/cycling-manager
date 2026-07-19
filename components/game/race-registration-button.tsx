"use client";

import { useFormStatus } from "react-dom";

export function RaceRegistrationButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-5 py-3 text-sm font-black uppercase tracking-wider text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B] disabled:cursor-wait disabled:opacity-60"
    >
      {pending
        ? "Inscription en cours…"
        : "Inscrire mon équipe"}
    </button>
  );
}
