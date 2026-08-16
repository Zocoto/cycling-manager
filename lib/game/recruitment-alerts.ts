import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
} from "@/lib/game/rider-profile";
import {
  STAFF_ROLE_DEFINITIONS,
  TRAINER_SPECIALTY_LABELS,
  type StaffRole,
  type TrainerSpecialty,
} from "@/lib/game/staff";

export type RecruitmentAlertType = "rider" | "staff";

export type RecruitmentAlert = {
  id: string;
  type: RecruitmentAlertType;
  countryId: string | null;
  countryName: string | null;
  countryCode: string | null;
  minimumOverall: number | null;
  ratingKey: RiderRatingKey | null;
  minimumRating: number | null;
  minimumPotentialSteps: number | null;
  staffRole: StaffRole | null;
  minimumStaffLevel: number | null;
  staffTrainerSpecialty: TrainerSpecialty | null;
  createdAt: string;
};

export type RecruitmentAlertCountry = {
  id: string;
  name: string;
  code: string;
};

export type RecruitmentAlertOverview = {
  alerts: RecruitmentAlert[];
  countries: RecruitmentAlertCountry[];
};

export const RIDER_ALERT_METRICS: ReadonlyArray<{
  key: "overall" | RiderRatingKey;
  label: string;
}> = [
  { key: "overall", label: "Niveau général" },
  ...RIDER_RATING_AXES.map((axis) => ({
    key: axis.key,
    label: axis.label,
  })),
];

export function describeRecruitmentAlert(alert: RecruitmentAlert): string {
  const criteria: string[] = [];

  if (alert.countryName) criteria.push(alert.countryName);

  if (alert.type === "rider") {
    if (alert.minimumOverall !== null) {
      criteria.push(`niveau général ≥ ${alert.minimumOverall}`);
    }

    if (alert.ratingKey && alert.minimumRating !== null) {
      const label =
        RIDER_RATING_AXES.find((axis) => axis.key === alert.ratingKey)?.label ??
        alert.ratingKey;
      criteria.push(`${label.toLocaleLowerCase("fr")} ≥ ${alert.minimumRating}`);
    }

    if (alert.minimumPotentialSteps !== null) {
      criteria.push(
        `talent potentiel ≥ ${formatPotentialStars(alert.minimumPotentialSteps)}`,
      );
    }
  } else {
    if (alert.staffRole) {
      criteria.push(STAFF_ROLE_DEFINITIONS[alert.staffRole].label);
    }

    if (alert.minimumStaffLevel !== null) {
      criteria.push(`${alert.minimumStaffLevel} étoile${alert.minimumStaffLevel > 1 ? "s" : ""} minimum`);
    }

    if (alert.staffTrainerSpecialty) {
      criteria.push(
        `spécialité ${TRAINER_SPECIALTY_LABELS[
          alert.staffTrainerSpecialty
        ].toLocaleLowerCase("fr")}`,
      );
    }
  }

  return criteria.join(" · ");
}

export function formatPotentialStars(steps: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(steps / 2)} ★`;
}
