import type { RaceCalendarEdition } from "./race-calendar";

export function getNationalChampionshipResultHref(
  edition: {
    status?: RaceCalendarEdition["status"];
    slug: string;
    stages: Array<{ stageNumber: number }>;
  },
): string | null {
  if (edition.status !== "completed") return null;
  const stage = edition.stages[0];
  return stage
    ? `/jeu/resultats/${edition.slug}/${stage.stageNumber}`
    : null;
}

export function getNationalChampionshipRiderResultLabel(
  rider: { status: "entered" | "did_not_start"; finalRank: number | null },
  editionStatus: RaceCalendarEdition["status"],
): string {
  if (editionStatus === "cancelled") return "Annulé";
  if (rider.status === "did_not_start") return "Non partant";
  if (editionStatus !== "completed") return "En attente";
  return rider.finalRank !== null ? `${rider.finalRank}e` : "Non classé";
}
