import type { SponsorSportingPhilosophy } from "@/lib/game/sponsor-philosophy";

export type SponsorObjectiveType =
  | "race_result"
  | "nationality_quota"
  | "season_wins"
  | "uci_ranking"
  | "nation_uci_ranking"
  | "national_championship"
  | "homegrown_roster"
  | "youth_development"
  | "infrastructure";

export type SponsorObjectivePriority =
  | "optional"
  | "standard"
  | "important"
  | "mandatory";

export type SponsorObjectiveStatus =
  | "draft"
  | "active"
  | "completed"
  | "failed"
  | "cancelled";

export type RaceResultObjectiveDetails = {
  kind: "race_result";
  raceId: string;
  raceEditionId: string | null;
  raceSlug: string;
  raceLabel: string;
  countryCode: string;
  achievementType: "win" | "top_n";
  targetRank: number | null;
  requiredCount: number;
};

export type NationalityQuotaObjectiveDetails = {
  kind: "nationality_quota";
  countryCode: string;
  minimumPercentage: number;
};

export type SeasonWinsObjectiveDetails = {
  kind: "season_wins";
  minimumWinCount: number;
  winScope:
    | "all"
    | "one_day_races"
    | "stages"
    | "stage_race_general";
};

export type UciRankingObjectiveDetails = {
  kind: "uci_ranking";
  rankingScope: "teams";
  targetRank: number;
};

export type NationUciRankingObjectiveDetails = {
  kind: "nation_uci_ranking";
  countryCode: string;
  targetRank: number;
};

export type NationalChampionshipObjectiveDetails = {
  kind: "national_championship";
  countryCode: string;
  championshipType: "any" | "road" | "time_trial";
  requiredTitleCount: number;
};

export type HomegrownRosterObjectiveDetails = {
  kind: "homegrown_roster";
  minimumPercentage: number;
};

export type YouthDevelopmentObjectiveDetails = {
  kind: "youth_development";
  metric:
    | "promotions"
    | "development_roster"
    | "junior_race_wins"
    | "homegrown_sales";
  minimumCount: number;
};

export type InfrastructureObjectiveDetails = {
  kind: "infrastructure";
  minimumCompletedCount: number;
};

type SponsorObjectiveTarget =
  | RaceResultObjectiveDetails
  | NationalityQuotaObjectiveDetails
  | SeasonWinsObjectiveDetails
  | UciRankingObjectiveDetails
  | NationUciRankingObjectiveDetails
  | NationalChampionshipObjectiveDetails
  | HomegrownRosterObjectiveDetails
  | YouthDevelopmentObjectiveDetails
  | InfrastructureObjectiveDetails;

export type SponsorObjectiveTargetDetails = SponsorObjectiveTarget & {
  generationVersion?: number;
  sportingPhilosophy?: SponsorSportingPhilosophy;
};

export type GeneratedSponsorObjective = {
  displayOrder: number;
  name: string;
  description: string;
  objectiveType: SponsorObjectiveType;
  priority: SponsorObjectivePriority;
  evaluationTiming: "season_end";
  evaluationDayNumber: null;
  satisfactionPoints: number;
  renewalBonusPercent: number;
  isProvisional: true;
  targetDetails: SponsorObjectiveTargetDetails;
};

export type PersistedSponsorObjective =
  GeneratedSponsorObjective & {
    id: string;
    status: SponsorObjectiveStatus;
  };
