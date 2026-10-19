import { SPONSOR_SPORTING_PHILOSOPHY_CONFIG, type SponsorSportingPhilosophy } from "./sponsor-philosophy";
import type { RaceCalendarEdition, RaceCalendarStage, SeasonRaceCalendar } from "./race-calendar";
import type { OfficialRaceEditionResults } from "./race-results";
import type { SponsorContractObjective, PersistedSponsorContract } from "@/services/sponsoring-workflow";

export type SponsorProject = {
  contractId: string;
  seasonId: string;
  sponsorName: string;
  philosophy: SponsorSportingPhilosophy;
  satisfactionScore: number;
  objectives: SponsorContractObjective[];
};

/** Presentation of the signed annual snapshot only. Never generates or evaluates objectives. */
export function sponsorProjectFromContract(contract: PersistedSponsorContract): SponsorProject | null {
  if (contract.status !== "active") return null;
  return { contractId: contract.id, seasonId: contract.objectiveSeasonId, sponsorName: contract.sponsor.name,
    philosophy: contract.sportingPhilosophy, satisfactionScore: contract.satisfactionScore, objectives: contract.objectives };
}

export function getSponsorProjectPriorities(project: SponsorProject, scope?: "roster" | "youth") {
  const ordered = project.objectives.filter(objective => {
    if (objective.status === "cancelled" || objective.status === "draft") return false;
    if (scope === "roster") return ["nationality_quota", "homegrown_roster", "rider_recruitment"].includes(objective.targetDetails.kind);
    if (scope === "youth") return ["youth_development", "homegrown_roster"].includes(objective.targetDetails.kind);
    return true;
  }).sort((a, b) => Number(a.status === "completed" || a.status === "failed") - Number(b.status === "completed" || b.status === "failed")
    || Number(Boolean(b.mainObjectiveTerms)) - Number(Boolean(a.mainObjectiveTerms))
    || b.satisfactionPoints - a.satisfactionPoints || a.displayOrder - b.displayOrder);
  const priorities = ordered.slice(0, 3);
  const nextRace = !scope && ordered.find(objective => objective.status === "active" && objective.targetDetails.kind === "race_result");
  if (nextRace && !priorities.includes(nextRace)) priorities.splice(2, 1, nextRace);
  return priorities;
}

export function getSponsorRaceObjectives(project: SponsorProject, edition: Pick<RaceCalendarEdition, "id" | "raceId">) {
  return project.objectives.filter(objective => {
    const target = objective.targetDetails;
    return target.kind === "race_result" && objective.status !== "draft" && objective.status !== "cancelled"
      // Never attach a current objective to another season's edition of the same race.
      && (target.raceEditionId ? target.raceEditionId === edition.id : target.raceId === edition.raceId);
  });
}

export function hasSponsorRaceAffinity(philosophy: SponsorSportingPhilosophy, edition: RaceCalendarEdition, stage?: RaceCalendarStage) {
  if (edition.status === "cancelled" || (edition.competitionType !== "standard" && edition.competitionType !== "national_time_trial")) return false;
  const stages = (stage ? [stage] : edition.stages).filter(item => item.status !== "cancelled");
  const hasProfile = (profile: string) => stages.some(item => item.profileType === profile);
  switch (philosophy) {
    case "cobbled_classics": return edition.raceFormat === "one_day" && hasProfile("cobbles");
    case "ardennes_classics": return edition.raceFormat === "one_day" && hasProfile("hilly");
    case "medium_stage_races": return edition.raceFormat === "stage_race" && !edition.isGrandTour;
    case "grand_tour_general": return edition.isGrandTour === true;
    case "time_trials": return stages.some(item => ["individual_time_trial", "team_time_trial", "prologue"].includes(item.stageType) || item.profileType === "time_trial");
    case "sprints": return stages.some(item => item.stageType === "road" && ["flat", "sprint"].includes(item.profileType));
    default: return false;
  }
}

export function annotateSponsorCalendar(calendar: SeasonRaceCalendar, project: SponsorProject | null): SeasonRaceCalendar {
  if (!project || project.seasonId !== calendar.seasonId) return calendar;
  const objectiveEditionIds = new Set<string>();
  const objectiveRaceIds = new Set<string>();
  for (const objective of project.objectives) {
    if (objective.targetDetails.kind !== "race_result" || objective.status === "cancelled" || objective.status === "draft") continue;
    if (objective.targetDetails.raceEditionId) objectiveEditionIds.add(objective.targetDetails.raceEditionId);
    else objectiveRaceIds.add(objective.targetDetails.raceId);
  }
  return { ...calendar, editions: calendar.editions.map<RaceCalendarEdition>(edition => {
    const objective = edition.isSponsorObjective || objectiveEditionIds.has(edition.id) || objectiveRaceIds.has(edition.raceId);
    const interest = objective ? "objective" : hasSponsorRaceAffinity(project.philosophy, edition) ? "affinity" : null;
    return interest ? { ...edition, sponsorInterest: interest, isSponsorObjective: Boolean(objective) } : edition;
  }) };
}

export function getSponsorProjectLabel(project: SponsorProject) {
  return SPONSOR_SPORTING_PHILOSOPHY_CONFIG[project.philosophy].label;
}

export function getSponsorDashboardFocus(project: SponsorProject, calendar: SeasonRaceCalendar | null, eligibleEditions: readonly RaceCalendarEdition[]) {
  if (calendar?.seasonId === project.seasonId) {
    const candidates = new Map(eligibleEditions.map(edition => [edition.id, edition]));
    for (const edition of calendar.editions) {
      if (["accepted", "pending"].includes(edition.currentTeamRegistration?.status ?? "")
        && edition.status !== "completed" && edition.status !== "cancelled"
        && edition.stages.some(stage => stage.status !== "cancelled" && stage.dayNumber >= calendar.currentDayNumber)) candidates.set(edition.id, edition);
    }
    for (const edition of [...candidates.values()].sort((a, b) => Math.min(...a.stages.map(stage => stage.dayNumber)) - Math.min(...b.stages.map(stage => stage.dayNumber)))) {
      const objective = getSponsorRaceObjectives(project, edition).find(item => item.status === "active");
      if (objective) return objective;
    }
  }
  return getSponsorProjectPriorities(project).find(objective => objective.status === "active" && objective.targetDetails.kind !== "race_result") ?? null;
}

export type SponsorRaceBrief = {
  sponsorName: string;
  scope: "general" | "race" | "stages";
  objectives: SponsorContractObjective[];
};

export function buildSponsorRaceBrief(project: SponsorProject | null, edition: RaceCalendarEdition): SponsorRaceBrief | null {
  if (!project || edition.status === "cancelled") return null;
  const objectives = getSponsorRaceObjectives(project, edition).slice(0, 3);
  if (!objectives.length && !hasSponsorRaceAffinity(project.philosophy, edition)) return null;
  return { sponsorName: project.sponsorName, objectives,
    scope: edition.raceFormat !== "stage_race" ? "race" : objectives.length
      || ["grand_tour_general", "medium_stage_races"].includes(project.philosophy) ? "general" : "stages" };
}

export function isSponsorRaceReportFinal(edition: RaceCalendarEdition, official: OfficialRaceEditionResults | null, stageId: string) {
  if (!official || official.editionId !== edition.id || !official.isComplete || official.generalIsProvisional || !edition.stages.length) return false;
  const lastStageNumber = Math.max(...edition.stages.filter(stage => stage.status !== "cancelled").map(stage => stage.stageNumber));
  return official.stages.some(stage => stage.stageId === stageId && stage.stageNumber === lastStageNumber);
}
