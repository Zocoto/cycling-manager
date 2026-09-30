import type { RatingScale, RatingSource } from "@/lib/game/pcm-export/ratings";

export type SeasonRow = {
  id: string;
  game_year: number;
  status: string;
  [key: string]: unknown;
};

export type TeamSeasonRow = {
  id: string;
  season_id: string;
  team_id: string;
  division_id: string;
  registration_country_id: string;
  display_name: string;
  short_name: string | null;
  status: string;
  operating_budget: number | null;
  final_rank: number | null;
  [key: string]: unknown;
};

export type TeamRow = {
  id: string;
  home_country_id: string;
  amateur_jersey_primary_color: string | null;
  amateur_jersey_secondary_color: string | null;
  [key: string]: unknown;
};

export type CountryRow = {
  id: string;
  iso_alpha3: string;
  name: string;
  continent_code: string;
  [key: string]: unknown;
};

export type DivisionRow = {
  id: string;
  code: string;
  [key: string]: unknown;
};

export type ContractRow = {
  id: string;
  rider_id: string;
  team_id: string;
  start_season_id: string;
  end_season_id: string;
  salary_per_season: number | null;
  status: string;
  [key: string]: unknown;
};

export type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
  country_id: string;
  height_cm: number | null;
  weight_kg: number | null;
  potential_steps: number | null;
  [key: string]: unknown;
};

export type RatingRow = RatingSource & {
  id: string;
  rider_id: string;
  season_id: string;
  age: number;
  [key: string]: unknown;
};

export type PcmExportSnapshot = {
  schemaVersion: 1;
  source: "Cyclostratege production";
  exportedAt: string;
  sha256: string;
  activeSeason: SeasonRow;
  seasons: SeasonRow[];
  counts: {
    teams: number;
    riders: number;
    contracts: number;
    ratings: number;
  };
  ratingPolicy: {
    source: "native rider_season_ratings only";
    bonusesIncluded: false;
    scale: RatingScale;
  };
  teamSeasons: TeamSeasonRow[];
  teams: TeamRow[];
  countries: CountryRow[];
  divisions: DivisionRow[];
  contracts: ContractRow[];
  riders: RiderRow[];
  ratings: RatingRow[];
};

export type PcmExportMetadata = {
  generatedAt: string;
  season: number;
  snapshotSha256: string;
  outputSha256: string;
  filename: string;
  bytes: number;
  counts: {
    teams: number;
    riders: number;
    sponsors: number;
    contracts: number;
  };
  divisionCounts: Record<"10" | "11" | "12", number>;
  ratingScale: RatingScale;
  ratingRange: {
    minimum: number;
    maximum: number;
  };
  countryFallbacks: Array<{
    sourceCode: string;
    sourceName: string;
    pcmCode: string;
  }>;
  scope: {
    nativeRatingsOnly: true;
    bonusesIncluded: false;
    graphicalAssetsIncluded: false;
    existingPcmContentPreserved: true;
  };
};

export type PcmExportResult = {
  cdb: Uint8Array;
  metadata: PcmExportMetadata;
};
