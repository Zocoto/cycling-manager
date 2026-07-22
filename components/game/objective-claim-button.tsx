"use client";

import { useFormStatus } from "react-dom";

export function ObjectiveClaimButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F2C94C] px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
    >
      <GiftIcon />
      {pending ? "Attribution…" : "Récupérer la récompense"}
    </button>
  );
}

function GiftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="h-4 w-4"
    >
      <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
      <path d="M12 7H8.8C6.5 7 6 3.8 8.1 3.2c1.9-.6 3 1.8 3.9 3.8ZM12 7h3.2c2.3 0 2.8-3.2.7-3.8C14 2.6 12.9 5 12 7Z" />
    </svg>
  );
}
