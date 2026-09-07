import {
  getRaceClimatePerformanceAdjustment,
  getRiderClimateProfile,
  type RaceWeather,
} from "./race-weather";

export const FEDERATION_SELECTION_SORT_OPTIONS = [
  { key: "overall", label: "Moyenne" },
  { key: "mountain", label: "Montagne" },
  { key: "hills", label: "Vallons" },
  { key: "flat", label: "Plaine" },
  { key: "timeTrial", label: "Contre-la-montre" },
  { key: "cobbles", label: "Pavés" },
  { key: "sprint", label: "Sprint" },
  { key: "acceleration", label: "Accélération" },
  { key: "downhill", label: "Descente" },
  { key: "endurance", label: "Endurance" },
  { key: "resistance", label: "Résistance" },
  { key: "recovery", label: "Récupération" },
  { key: "breakaway", label: "Échappée" },
  { key: "prologue", label: "Prologue" },
  { key: "weatherAffinity", label: "Affinité avec la météo annoncée" },
] as const;

export type FederationSelectionSortKey =
  (typeof FEDERATION_SELECTION_SORT_OPTIONS)[number]["key"];
export type FederationSelectionSortDirection = "ascending" | "descending";

export type FederationSelectionSortableRider = {
  id: string;
  name: string;
  overall: number;
  ratings: Record<Exclude<FederationSelectionSortKey, "overall" | "weatherAffinity">, number>;
};

export function sortFederationSelectionRiders<
  Rider extends FederationSelectionSortableRider,
>(
  riders: readonly Rider[],
  {
    key,
    direction,
    countryCode,
    weather,
  }: {
    key: FederationSelectionSortKey;
    direction: FederationSelectionSortDirection;
    countryCode: string;
    weather: RaceWeather | null;
  },
): Rider[] {
  const multiplier = direction === "descending" ? -1 : 1;

  return [...riders].sort((left, right) => {
    const leftValue = getFederationSelectionSortValue(left, {
      key,
      countryCode,
      weather,
    });
    const rightValue = getFederationSelectionSortValue(right, {
      key,
      countryCode,
      weather,
    });
    const difference = (leftValue - rightValue) * multiplier;

    return difference || left.name.localeCompare(right.name, "fr");
  });
}

export function getFederationSelectionSortValue(
  rider: FederationSelectionSortableRider,
  {
    key,
    countryCode,
    weather,
  }: {
    key: FederationSelectionSortKey;
    countryCode: string;
    weather: RaceWeather | null;
  },
) {
  if (key === "overall") return rider.overall;
  if (key !== "weatherAffinity") return rider.ratings[key];
  if (!weather) return 0;

  return getRaceClimatePerformanceAdjustment(
    getRiderClimateProfile({ riderId: rider.id, countryCode }),
    weather,
  );
}

export function getFederationSelectionSortLabel(
  key: FederationSelectionSortKey,
) {
  return (
    FEDERATION_SELECTION_SORT_OPTIONS.find((option) => option.key === key)
      ?.label ?? "Moyenne"
  );
}
