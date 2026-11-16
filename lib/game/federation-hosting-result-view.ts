import {
  isInternationalChampionshipEdition,
  isProfessionalNationsCupEdition,
  type RaceCalendarEdition,
} from "@/lib/game/race-calendar";

export function canTrackFederationHostedProResult(
  gameYear: number,
  edition: Pick<RaceCalendarEdition, "status" | "isNeutralHost" | "isJuniorChampionship" | "competitionType">,
): boolean {
  return (
    gameYear >= 6 &&
    edition.status === "completed" &&
    !edition.isNeutralHost &&
    !edition.isJuniorChampionship &&
    (isInternationalChampionshipEdition(edition) || isProfessionalNationsCupEdition(edition))
  );
}
