export type SponsorObjectiveType =
  | "race_result"
  | "nationality_quota"
  | "season_wins"
  | "uci_ranking";

export type SponsorObjectivePriority =
  | "optional"
  | "standard"
  | "important"
  | "mandatory";

export type SponsorObjectiveStatus =
  | "draft"
  | "active"
  | "completed"
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

export type SponsorObjectiveTargetDetails =
  | RaceResultObjectiveDetails
  | NationalityQuotaObjectiveDetails
  | SeasonWinsObjectiveDetails
  | UciRankingObjectiveDetails;

export type GeneratedSponsorObjective = {
  displayOrder: number;
  name: string;
  description: string;
  objectiveType: SponsorObjectiveType;
  priority: SponsorObjectivePriority;
  evaluationTiming: "season_end";
  evaluationDayNumber: null;
  renewalBonusPercent: number;
  isProvisional: true;
  targetDetails: SponsorObjectiveTargetDetails;
};

export type PersistedSponsorObjective =
  GeneratedSponsorObjective & {
    id: string;
    status: SponsorObjectiveStatus;
  };
