export const RIDER_SPECIAL_ABILITIES = [
  "flahute",
  "panache",
  "bottle_carrier",
  "locomotive",
  "giclette",
  "chase_potato",
  "sandwich_man",
  "iron_health",
  "first_in_class",
  "homegrown",
  "pistard",
  "three_lungs",
  "cyclocrossman",
  "metronome",
] as const;

export type RiderSpecialAbility =
  (typeof RIDER_SPECIAL_ABILITIES)[number];

export type SpecialAbilityDefinition = {
  code: RiderSpecialAbility;
  name: string;
  effect: string;
  icon:
    | "thigh"
    | "fireworks"
    | "bottle"
    | "locomotive"
    | "pump"
    | "potato"
    | "sandwich"
    | "walking_cane"
    | "ruler"
    | "baby_bottle"
    | "velodrome"
    | "lungs"
    | "cyclocross"
    | "metronome";
  tone:
    | "silver"
    | "gold"
    | "copper"
    | "anthracite"
    | "red"
    | "purple"
    | "green"
    | "slate"
    | "teal"
    | "pink"
    | "cobalt"
    | "lime"
    | "earth_sky"
    | "iridescent";
};

export const PISTARD_SHORT_TIME_TRIAL_MAX_KM = 12;
export const PISTARD_TIME_TRIAL_MAX_KM = 25;
export const THREE_LUNGS_FORM_REDUCTION = 0.25;
export const THREE_LUNGS_MAX_FORM_SAVING = 4;
export const CYCLOCROSSMAN_TERRAIN_BONUS = 3;
export const CYCLOCROSSMAN_COBBLED_CRASH_AVOIDANCE = 0.2;
export const METRONOME_BAD_DAY_MULTIPLIER = 0.5;

export const SPECIAL_ABILITY_CATALOG: SpecialAbilityDefinition[] = [
  {
    code: "flahute",
    name: "Flahute",
    effect: "Réduit de 12 % la dépense d’énergie dans la seconde moitié de course et sur les secteurs les plus exigeants.",
    icon: "thigh",
    tone: "silver",
  },
  {
    code: "panache",
    name: "Panache",
    effect: "Augmente fortement les chances de prendre l’échappée et autorise les contre-attaques audacieuses.",
    icon: "fireworks",
    tone: "gold",
  },
  {
    code: "bottle_carrier",
    name: "Porteur de bidon",
    effect: "Réduit de 3 % la dépense d’énergie des équipiers présents dans le même groupe.",
    icon: "bottle",
    tone: "copper",
  },
  {
    code: "locomotive",
    name: "Locomotive",
    effect: "Réduit de 16 % la dépense d’énergie lorsque le coureur travaille pour son groupe ou son équipe.",
    icon: "locomotive",
    tone: "anthracite",
  },
  {
    code: "giclette",
    name: "Giclette",
    effect: "Accorde un bonus lors des attaques décisives dans les arrivées qui ne se terminent pas par un sprint massif.",
    icon: "pump",
    tone: "red",
  },
  {
    code: "chase_potato",
    name: "Chasse patate",
    effect: "Permet de sortir seul du peloton pour tenter de rejoindre une échappée déjà formée.",
    icon: "potato",
    tone: "purple",
  },
  {
    code: "sandwich_man",
    name: "Homme Sandwich",
    effect: "Accorde +0,5 réputation après une échappée ou une victoire.",
    icon: "sandwich",
    tone: "green",
  },
  {
    code: "iron_health",
    name: "Santé de fer",
    effect: "Repousse le déclin d’un an et réduit ensuite de 30 % la perte naturelle de caractéristiques.",
    icon: "walking_cane",
    tone: "slate",
  },
  {
    code: "first_in_class",
    name: "Premier de la classe",
    effect: "Accorde +50 % de progression des caractéristiques lors des entraînements.",
    icon: "ruler",
    tone: "teal",
  },
  {
    code: "homegrown",
    name: "Formé au club",
    effect: "Accorde +2 à toutes les caractéristiques ; cette capacité est perdue définitivement en cas de départ ou de non-renouvellement.",
    icon: "baby_bottle",
    tone: "pink",
  },
  {
    code: "pistard",
    name: "Pistard",
    effect: "Améliore le placement dans les sprints massifs, empêche de perdre la bonne roue et accorde un bonus décroissant sur les prologues et CLM jusqu’à 25 km.",
    icon: "velodrome",
    tone: "cobalt",
  },
  {
    code: "three_lungs",
    name: "Trois poumons",
    effect: "Réduit de 25 % la perte de forme provoquée par les courses et les entraînements, dans la limite de 4 points économisés par événement.",
    icon: "lungs",
    tone: "lime",
  },
  {
    code: "cyclocrossman",
    name: "Cyclocrossman",
    effect: "Accorde +3 de performance de terrain sur les pavés et les bosses courtes ou roulantes, et réduit de 20 % le risque de chute sur les pavés.",
    icon: "cyclocross",
    tone: "earth_sky",
  },
  {
    code: "metronome",
    name: "Métronome",
    effect: "Divise par deux les malus des mauvais jours de course sans réduire les bonus des bons jours.",
    icon: "metronome",
    tone: "iridescent",
  },
];

export function getPistardTimeTrialBonus({
  hasPistard,
  distanceKm,
}: {
  hasPistard: boolean;
  distanceKm: number;
}) {
  if (!hasPistard) return 0;
  if (distanceKm <= PISTARD_SHORT_TIME_TRIAL_MAX_KM) return 3;
  if (distanceKm <= PISTARD_TIME_TRIAL_MAX_KM) return 2;
  return 0;
}

export function reduceThreeLungsFormLoss({
  hasThreeLungs,
  formDelta,
}: {
  hasThreeLungs: boolean;
  formDelta: number;
}) {
  if (!hasThreeLungs || formDelta >= 0) return formDelta;

  const loss = Math.abs(formDelta);
  const saving = Math.min(
    loss * THREE_LUNGS_FORM_REDUCTION,
    THREE_LUNGS_MAX_FORM_SAVING,
  );
  return -Math.round(Math.max(1, loss - saving) * 10) / 10;
}

export function getCyclocrossmanTerrainBonus({
  hasCyclocrossman,
  terrain,
  surface,
  distanceKm,
  averageGradientPct,
}: {
  hasCyclocrossman: boolean;
  terrain: "flat" | "climb" | "descent";
  surface: "asphalt" | "cobbles";
  distanceKm: number;
  averageGradientPct: number;
}) {
  if (!hasCyclocrossman) return 0;
  if (surface === "cobbles") return CYCLOCROSSMAN_TERRAIN_BONUS;

  const isShortOrRollingClimb =
    terrain === "climb" &&
    (distanceKm <= 12 || Math.abs(averageGradientPct) < 5.8);
  return isShortOrRollingClimb ? CYCLOCROSSMAN_TERRAIN_BONUS : 0;
}

export function doesCyclocrossmanAvoidCobbledCrash({
  hasCyclocrossman,
  isCobbled,
  roll,
}: {
  hasCyclocrossman: boolean;
  isCobbled: boolean;
  roll: number;
}) {
  return (
    hasCyclocrossman &&
    isCobbled &&
    Math.min(1, Math.max(0, roll)) < CYCLOCROSSMAN_COBBLED_CRASH_AVOIDANCE
  );
}

export function applyMetronomeToRaceDaySwing({
  hasMetronome,
  swing,
}: {
  hasMetronome: boolean;
  swing: number;
}) {
  return hasMetronome && swing < 0
    ? swing * METRONOME_BAD_DAY_MULTIPLIER
    : swing;
}

export function isRiderSpecialAbility(
  value: string
): value is RiderSpecialAbility {
  return (RIDER_SPECIAL_ABILITIES as readonly string[]).includes(value);
}

export function getSpecialAbilityDefinition(
  value: unknown,
): SpecialAbilityDefinition | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  if (!isRiderSpecialAbility(code)) return null;
  return (
    SPECIAL_ABILITY_CATALOG.find((ability) => ability.code === code) ?? null
  );
}

export function hasSpecialAbility(
  rider: {
    specialAbility?: RiderSpecialAbility | null;
    specialAbilities?: RiderSpecialAbility[];
  },
  ability: RiderSpecialAbility
): boolean {
  return (
    rider.specialAbility === ability ||
    rider.specialAbilities?.includes(ability) === true
  );
}
