import type { RaceCalendarEdition, RaceCalendarStage, SeasonRaceCalendar } from "@/lib/game/race-calendar";
import type { SponsorProject } from "@/lib/game/sponsor-project";
import type { SponsorContractObjective } from "@/services/sponsoring-workflow";

export function createSponsorProjectFixture() {
  const stage: RaceCalendarStage = { id: "stage", stageNumber: 1, dayNumber: 5, name: "Les pavés", stageType: "road", profileType: "cobbles",
    status: "planned", distanceKm: 160, daySlot: "early", departureAt: "2026-10-23T12:00:00Z", segments: [] };
  const edition: RaceCalendarEdition = { id: "edition", raceId: "race", slug: "paves-du-nord", name: "Pavés du Nord", shortName: null,
    status: "registration_open", countryCode: "FR", countryName: "France", continentCode: "EU", categoryCode: "continental", categoryName: "Continental",
    raceFormat: "one_day", competitionType: "standard", prestigeRank: 3, registrationPolicy: "open", minimumReputation: 100,
    minimumRosterSize: 3, maximumRosterSize: 8, registrationClosesAt: "2026-10-23T06:00:00Z", wildcardClosesAt: null, withdrawalClosesAt: null,
    currentTeamRegistration: null, engagedRiderCount: 0, engagedRiders: [], stages: [stage] };
  const objective: SponsorContractObjective = { id: "objective", name: "Top 10 sur les Pavés du Nord", description: null, displayOrder: 1,
    status: "active", satisfactionPoints: 12, targetDetails: { kind: "race_result", raceId: "race", raceEditionId: "edition", raceSlug: edition.slug,
      raceLabel: edition.name, countryCode: "FR", achievementType: "top_n", targetRank: 10, requiredCount: 1 },
    currentValue: null, targetValue: null, progressStatus: null, achievementLevel: null, partialSatisfactionPoints: 0, mainObjectiveTerms: null };
  const quota: SponsorContractObjective = { ...objective, id: "quota", name: "75 % de coureurs du pays du sponsor", displayOrder: 2,
    satisfactionPoints: 30, currentValue: 70, targetValue: 75, targetDetails: { kind: "nationality_quota", countryCode: "FR", minimumPercentage: 75 } };
  const project: SponsorProject = { contractId: "contract", seasonId: "season", sponsorName: "Partenaire des Collines", philosophy: "cobbled_classics",
    satisfactionScore: 24, objectives: [objective, quota] };
  const calendar: SeasonRaceCalendar = { seasonId: "season", seasonName: "Saison 4", gameYear: 4, startsOn: "2026-10-19", endsOn: "2026-11-15",
    currentDayNumber: 1, days: [], events: [], editions: [edition] };
  return { stage, edition, objective, quota, project, calendar };
}
