import {
  getRiderSportingProfile,
  RIDER_RATING_AXES,
  type RiderRatings,
} from "./rider-profile";
import {
  getDefaultRosterSortDirection,
  type RosterSortDirection,
  type RosterSortKey,
  type RosterSortValue,
} from "./roster-sort";
import { getSquadStatusRank, type SquadStatus } from "./squad-status";

export type TrainingRosterSortKey = "default" | "nationality" | RosterSortKey;

export type TrainingRosterSortRider = {
  id: string;
  firstName: string;
  lastName: string;
  squadStatus: SquadStatus | null;
  intensity?: number;
  age?: number | null;
  countryName?: string | null;
  potentialSteps?: number | null;
  form?: number | null;
  morale?: number | null;
  ratings?: RiderRatings | null;
};

export const TRAINING_ROSTER_SORT_OPTIONS = [
  { key: "default", label: "Ordre de l’effectif" },
  { key: "squad_status", label: "Statut dans l’équipe" },
  { key: "rider", label: "Nom du coureur" },
  { key: "nationality", label: "Nationalité" },
  { key: "age", label: "Âge" },
  { key: "profile", label: "Profil" },
  { key: "potential", label: "Potentiel" },
  { key: "form", label: "Forme" },
  { key: "morale", label: "Moral" },
  { key: "mountain", label: "Montagne" },
  { key: "hills", label: "Vallon" },
  { key: "flat", label: "Plaine" },
  { key: "time_trial", label: "Contre-la-montre" },
  { key: "cobbles", label: "Pavés" },
  { key: "sprint", label: "Sprint" },
  { key: "acceleration", label: "Accélération" },
  { key: "downhill", label: "Descente" },
  { key: "endurance", label: "Endurance" },
  { key: "resistance", label: "Résistance" },
  { key: "recovery", label: "Récupération" },
  { key: "breakaway", label: "Baroudeur" },
  { key: "prologue", label: "Prologue" },
  { key: "average", label: "Moyenne" },
] as const satisfies ReadonlyArray<{
  key: TrainingRosterSortKey;
  label: string;
}>;

export function getDefaultTrainingRosterSortDirection(
  key: TrainingRosterSortKey,
): RosterSortDirection {
  return key === "default" || key === "nationality"
    ? "asc"
    : getDefaultRosterSortDirection(key);
}

export function getTrainingRosterSortValue(
  rider: TrainingRosterSortRider,
  key: TrainingRosterSortKey,
): RosterSortValue {
  const { ratings } = rider;
  switch (key) {
    case "default":
      return null;
    case "rider":
      return `${rider.lastName} ${rider.firstName}`;
    case "nationality":
      return rider.countryName?.trim() || null;
    case "age":
      return finiteNumber(rider.age);
    case "squad_status":
      return getSquadStatusRank(rider.squadStatus);
    case "potential":
      return finiteNumber(rider.potentialSteps);
    case "form":
      return finiteNumber(rider.form);
    case "morale":
      return finiteNumber(rider.morale);
    case "profile":
      return hasCompleteRatings(ratings)
        ? getRiderSportingProfile(ratings)
        : null;
    case "average":
      return hasCompleteRatings(ratings)
        ? Math.round(RIDER_RATING_AXES.reduce(
            (total, axis) => total + ratings[axis.key],
            0,
          ) / RIDER_RATING_AXES.length)
        : null;
    case "time_trial":
      return finiteNumber(ratings?.timeTrial);
    default:
      return finiteNumber(ratings?.[key]);
  }
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasCompleteRatings(
  ratings: RiderRatings | null | undefined,
): ratings is RiderRatings {
  return Boolean(ratings && RIDER_RATING_AXES.every(
    (axis) => finiteNumber(ratings[axis.key]) !== null,
  ));
}
