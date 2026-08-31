export const ITEM_TARGET_RATING_KEYS = [
  "mountain",
  "hills",
  "flat",
  "time_trial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
] as const;

export type ItemTargetRatingKey =
  (typeof ITEM_TARGET_RATING_KEYS)[number];

export type ItemTargetRider = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  countryName: string | null;
  form: number;
  experienceDays: number;
  potentialSteps: number;
  ratings: Record<ItemTargetRatingKey, number>;
  abilityCodes: string[];
  injury?: {
    id: string;
    diagnosisCode: string;
    label: string;
    remainingHours: number;
    expectedRecoveryAt: string;
    canShorten: boolean;
  } | null;
};

export type ItemTargetValueContext =
  | { kind: "form" }
  | { kind: "experience" }
  | { kind: "potential" }
  | { kind: "nationality" }
  | { kind: "injury" }
  | { kind: "rating"; ratingKey: ItemTargetRatingKey | null }
  | { kind: "ability"; abilityCode: string | null };

const RATING_SHORT_LABELS: Record<ItemTargetRatingKey, string> = {
  mountain: "MON",
  hills: "VAL",
  flat: "PLA",
  time_trial: "CLM",
  cobbles: "PAV",
  sprint: "SPR",
  acceleration: "ACC",
  downhill: "DES",
  endurance: "END",
  resistance: "RES",
  recovery: "REC",
  breakaway: "ECH",
  prologue: "PRO",
};

export function formatItemTargetValue(
  rider: ItemTargetRider,
  context: ItemTargetValueContext
) {
  if (context.kind === "form") return `Forme ${rider.form}/100`;
  if (context.kind === "experience") {
    return `Expérience ${rider.experienceDays.toLocaleString("fr-FR")} j`;
  }
  if (context.kind === "potential") {
    return `Potentiel ${formatPotential(rider.potentialSteps)}/4 ★`;
  }
  if (context.kind === "nationality") {
    return rider.countryName
      ? `Nationalité ${rider.countryName}`
      : "Nationalité inconnue";
  }
  if (context.kind === "injury") {
    if (!rider.injury) return "Aucune blessure active";
    if (!rider.injury.canShorten) {
      return `${rider.injury.label} · durée fixe`;
    }
    return `${rider.injury.label} · ${formatRemainingHours(
      rider.injury.remainingHours,
    )} restantes`;
  }
  if (context.kind === "ability") {
    if (!context.abilityCode) return "Choisir une capacité";
    return rider.abilityCodes.includes(context.abilityCode)
      ? "Déjà acquise"
      : "Non acquise";
  }
  if (!context.ratingKey) return "Choisir une statistique";
  return `${RATING_SHORT_LABELS[context.ratingKey]} ${
    rider.ratings[context.ratingKey]
  }/100`;
}

export function canReceiveInjuryCareItem(rider: ItemTargetRider) {
  return Boolean(rider.injury?.canShorten && rider.injury.remainingHours > 0);
}

export function readItemTargetRatingKey(
  value: unknown
): ItemTargetRatingKey | null {
  return typeof value === "string" &&
    (ITEM_TARGET_RATING_KEYS as readonly string[]).includes(value)
    ? (value as ItemTargetRatingKey)
    : null;
}

export function readItemAbilityCode(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatPotential(potentialSteps: number) {
  return (Math.max(0, Math.min(8, potentialSteps)) / 2).toLocaleString(
    "fr-FR",
    { maximumFractionDigits: 1 }
  );
}

function formatRemainingHours(value: number) {
  const hours = Math.max(1, Math.round(value));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days === 0) return `${hours} h`;
  if (remainingHours === 0) return `${days} j`;
  return `${days} j ${remainingHours} h`;
}
