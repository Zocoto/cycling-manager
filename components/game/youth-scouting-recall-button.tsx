"use client";

import { useFormStatus } from "react-dom";
import { useLocale } from "@/components/i18n/locale-provider";

export function YouthScoutingRecallButton() {
  const { pending } = useFormStatus();
  const { locale } = useLocale();
  const confirmation = locale === "en"
    ? "The scout will return without a report and be available again. Confirm recall?"
    : "Le scout rentrera sans rapport et sera de nouveau disponible. Confirmer le rappel ?";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => {
        if (window.confirm(confirmation)) event.currentTarget.form?.requestSubmit();
      }}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#C75B4B]/25 bg-[#FFF2EF] px-3 py-2 text-xs font-black text-[#9B4035] transition hover:border-[#C75B4B]/45 hover:bg-[#FFE7E1] disabled:cursor-wait disabled:opacity-55"
    >
      {pending ? "Rappel en cours…" : "Rappeler le scout"}
    </button>
  );
}
