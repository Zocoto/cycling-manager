"use client";

import { useFormStatus } from "react-dom";

export function RaceWithdrawButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (
          !window.confirm(
            "Retirer toute l’équipe ? Vous pourrez vous réinscrire avec une nouvelle composition uniquement avant H-12."
          )
        ) {
          event.preventDefault();
        }
      }}
      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-red-200/30 bg-red-300/10 px-4 py-2.5 text-sm font-black text-red-100 transition hover:bg-red-300/20 disabled:cursor-wait disabled:opacity-60"
    >
      {pending
        ? "Retrait en cours…"
        : "Désinscrire toute l’équipe"}
    </button>
  );
}
