"use client";

import { useFormStatus } from "react-dom";

export function CampInterruptionSubmitButton({
  kind,
  effectiveDayNumber,
}: {
  kind: "form" | "reconnaissance";
  effectiveDayNumber: number;
}) {
  const { pending } = useFormStatus();
  const confirmation =
    kind === "reconnaissance"
      ? `Interrompre cette reconnaissance ? L’arrêt prendra effet à J${effectiveDayNumber} : les coureurs seront de nouveau disponibles ce jour-là. Le coût ne sera pas remboursé et aucun bonus de reconnaissance ne sera accordé.`
      : `Interrompre ce stage de remise en forme ? L’arrêt prendra effet à J${effectiveDayNumber} : le coureur sera de nouveau disponible ce jour-là. Le coût ne sera pas remboursé, mais les gains de forme des journées effectuées resteront acquis.`;

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#C75B4B]/25 bg-[#FFF2EF] px-4 py-2 text-xs font-black text-[#9B4035] transition hover:border-[#C75B4B]/45 hover:bg-[#FFE7E1] disabled:cursor-wait disabled:opacity-55"
    >
      {pending ? "Arrêt programmé…" : "Interrompre le stage"}
    </button>
  );
}

export function PlannedCampCancellationSubmitButton({
  startDayNumber,
  endDayNumber,
}: {
  startDayNumber: number;
  endDayNumber: number;
}) {
  const { pending } = useFormStatus();
  const confirmation = `Annuler ce stage prévu de J${startDayNumber} à J${endDayNumber} ? Le coureur restera disponible. Le coût ne sera pas remboursé.`;

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#C75B4B]/25 bg-[#FFF2EF] px-4 py-2 text-xs font-black text-[#9B4035] transition hover:border-[#C75B4B]/45 hover:bg-[#FFE7E1] disabled:cursor-wait disabled:opacity-55"
    >
      {pending ? "Annulation…" : "Annuler le stage"}
    </button>
  );
}
