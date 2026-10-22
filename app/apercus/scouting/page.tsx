import { notFound } from "next/navigation";
import "flag-icons/css/flag-icons.min.css";
import { YouthScoutingMap } from "@/components/game/youth-scouting-map";
import { COUNTRY_MAP_COORDINATES } from "@/data/country-map-coordinates";
import type { YouthCountry } from "@/services/youth-development";

export const metadata = { title: "Scouting · aperçu local", robots: { index: false, follow: false } };

export default function ScoutingPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const names = new Intl.DisplayNames(["fr"], { type: "region" });
  const countries: YouthCountry[] = Object.entries(COUNTRY_MAP_COORDINATES).map(([code, coordinate]) => ({
    id: `preview-${code}`, code, name: names.of(code) ?? code, ...coordinate,
    reputation: 7, reputationSourceSeasonName: "Saison 3", uciNationRank: 10,
    specialty: "rouleur", secondarySpecialty: "puncheur", specialtyLabel: "Rouleurs",
    secondarySpecialtyLabel: "Puncheurs", facilityLevel: 1,
  }));
  return <main className="mx-auto max-w-[1500px] p-4 sm:p-8">
    <p className="mb-5 text-sm font-semibold">Aperçu local · données fictives · aucun recrutement possible</p>
    <YouthScoutingMap countries={countries} scouts={[]} currentDayNumber={10} defaultCountryId="preview-BE" tutorialMode
      scoutingSupervision={{ currentPercentage: 0, stableThroughDayNumber: null, remainingDays: 0, effects: [] }} />
  </main>;
}
