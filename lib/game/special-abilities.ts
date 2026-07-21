export const RIDER_SPECIAL_ABILITIES = [
  "flahute",
  "panache",
  "bottle_carrier",
  "locomotive",
  "giclette",
  "chase_potato",
  "sandwich_man",
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
    | "sandwich";
  tone: "silver" | "gold" | "copper" | "anthracite" | "red" | "purple" | "green";
};

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
];

export function isRiderSpecialAbility(
  value: string
): value is RiderSpecialAbility {
  return (RIDER_SPECIAL_ABILITIES as readonly string[]).includes(value);
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
