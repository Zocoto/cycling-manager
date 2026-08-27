"use client";

import { useFormStatus } from "react-dom";

export function StaffDismissalSubmitButton({
  staffName,
  compensationLabel,
  currentSeasonLabel,
  resultingBalanceLabel,
  resultingBalanceIsNegative,
  mutualAgreement,
}: {
  staffName: string;
  compensationLabel: string;
  currentSeasonLabel: string;
  resultingBalanceLabel: string;
  resultingBalanceIsNegative: boolean;
  mutualAgreement: boolean;
}) {
  const { pending } = useFormStatus();

  function confirmDismissal(event: React.MouseEvent<HTMLButtonElement>) {
    const confirmed = window.confirm(
      [
        `Licencier ${staffName} ?`,
        "",
        mutualAgreement
          ? "Licenciement à l’amiable : aucune indemnité"
          : `Indemnité immédiate : ${compensationLabel}`,
        mutualAgreement
          ? "• Votre trésorerie est négative au moment de la demande."
          : `• Solde de la saison en cours : ${currentSeasonLabel}`,
        `• Trésorerie après licenciement : ${resultingBalanceLabel}`,
        "",
        mutualAgreement
          ? "La rupture sera gratuite si la trésorerie est toujours négative lors de la validation."
          : resultingBalanceIsNegative
          ? "Attention : cette rupture placera votre trésorerie dans le négatif."
          : "L’indemnité sera débitée immédiatement.",
        "Le contrat et tous ses effets actifs prendront fin immédiatement.",
        "Une mission de scout ou une formation à l’Académie en cours sera annulée sans remboursement.",
        "",
        "Cette décision est définitive.",
      ].join("\n"),
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      onClick={confirmDismissal}
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#C94848]/35 bg-[#FFF1F1] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#A12E2E] transition hover:border-[#C94848]/55 hover:bg-[#FDE3E3] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? "Licenciement…"
        : mutualAgreement
          ? "Licencier à l’amiable"
          : "Licencier ce membre"}
    </button>
  );
}
