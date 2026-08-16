"use client";

import { useLocale } from "@/components/i18n/locale-provider";

export function EquipmentRatingBonus({
  bonus,
  className = "",
}: {
  bonus: number | null | undefined;
  className?: string;
}) {
  const { locale } = useLocale();
  const normalizedBonus = Number(bonus ?? 0);
  if (!Number.isFinite(normalizedBonus) || normalizedBonus <= 0) return null;

  const formattedBonus = new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    maximumFractionDigits: 2,
  }).format(normalizedBonus);

  return (
    <span
      data-equipment-rating-bonus="true"
      aria-label={`${locale === "en" ? "Equipment bonus" : "Bonus équipement"} : +${formattedBonus}`}
      className={`ml-1 inline-flex items-center rounded-full border border-[#78AEDA] bg-[#F7FBFF] px-1.5 py-0.5 align-baseline font-black leading-none whitespace-nowrap text-[#145A8D] shadow-[0_1px_2px_rgba(7,26,23,0.16)] ${className}`.trim()}
    >
      +{formattedBonus}
    </span>
  );
}
