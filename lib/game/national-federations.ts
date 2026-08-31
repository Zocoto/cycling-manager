export const FEDERATION_MANAGEMENT_START_GAME_YEAR = 3;

export const NATIONAL_FEDERATION_TABS = [
  "overview",
  "selections",
  "infrastructures",
  "finances",
  "governance",
  "lounge",
] as const;

export type NationalFederationTab =
  (typeof NATIONAL_FEDERATION_TABS)[number];

export type FederationDivisionPreview = {
  division: 1 | 2 | 3 | 4;
  group: "A" | "B" | "C" | null;
  label: string;
};

export type FederationManagementPhase = "preview" | "automatic";

export function parseNationalFederationTab(
  value: string | string[] | undefined,
): NationalFederationTab {
  const candidate = Array.isArray(value) ? value[0] : value;

  return NATIONAL_FEDERATION_TABS.includes(
    candidate as NationalFederationTab,
  )
    ? (candidate as NationalFederationTab)
    : "overview";
}

export function getFederationManagementPhase(
  gameYear: number,
): FederationManagementPhase {
  return gameYear < FEDERATION_MANAGEMENT_START_GAME_YEAR
    ? "preview"
    : "automatic";
}

export function isFederationManagementSeason(gameYear: number): boolean {
  return gameYear >= FEDERATION_MANAGEMENT_START_GAME_YEAR;
}

export function getFederationDivisionPreview(
  nationRank: number | null,
): FederationDivisionPreview {
  if (!nationRank || nationRank < 1) {
    return {
      division: 4,
      group: null,
      label: "Division 4 · groupe à confirmer",
    };
  }

  if (nationRank <= 20) {
    return { division: 1, group: null, label: "Division 1" };
  }

  if (nationRank <= 60) {
    const group = getSerpentineGroup(nationRank - 21, 2);
    return { division: 2, group, label: `Division 2 · groupe ${group}` };
  }

  if (nationRank <= 100) {
    const group = getSerpentineGroup(nationRank - 61, 2);
    return { division: 3, group, label: `Division 3 · groupe ${group}` };
  }

  const group = getSerpentineGroup(nationRank - 101, 3);
  return { division: 4, group, label: `Division 4 · groupe ${group}` };
}

export function getInternationalAcademyImpact(
  qualityLevels: readonly number[],
): number {
  const contribution = qualityLevels.reduce(
    (total, qualityLevel) =>
      total + Math.max(0, Math.min(5, Math.trunc(qualityLevel))) * 10,
    0,
  );

  return Math.min(90, contribution);
}

function getSerpentineGroup(
  zeroBasedRank: number,
  groupCount: 2 | 3,
): "A" | "B" | "C" {
  const row = Math.floor(zeroBasedRank / groupCount);
  const position = zeroBasedRank % groupCount;
  const serpentinePosition = row % 2 === 0 ? position : groupCount - 1 - position;

  return (["A", "B", "C"] as const)[serpentinePosition] ?? "A";
}
