"use client";

import { useLocale } from "@/components/i18n/locale-provider";

type SecondarySponsorRosterObjectiveProps = {
  countryCode: string;
  requiredCount: number;
  currentCount?: number;
  progress?: boolean;
};

export function SecondarySponsorRosterObjective({ countryCode, requiredCount, currentCount = 0, progress = false }: SecondarySponsorRosterObjectiveProps) {
  const { locale } = useLocale();
  const country = new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
  const riders = locale === "en"
    ? requiredCount === 1 ? "rider" : "riders"
    : requiredCount === 1 ? "coureur" : "coureurs";

  if (!progress) {
    return <p>{locale === "en" ? `${requiredCount} ${riders} from ${country}` : `${requiredCount} ${riders} (${country})`}</p>;
  }
  return (
    <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
      {`${currentCount} / ${requiredCount} ${riders} · ${country}`}
      <span className="block">{locale === "en" ? "Bonus paid as soon as the required number is reached." : "Prime versée dès que le contingent est atteint."}</span>
    </p>
  );
}
