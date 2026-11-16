export const RIDER_PERSONALITIES = {
  franc_tireur: {
    label: "Franc-tireur",
    description: "Tente plus volontiers sa chance en solitaire quand il a carte blanche et dose mieux son effort seul à l’avant.",
  },
  opportuniste: {
    label: "Opportuniste",
    description: "Préfère suivre une accélération adverse plutôt que lancer lui-même le mouvement.",
  },
  calculateur: {
    label: "Calculateur",
    description: "Préserve davantage sa réserve et laisse plus volontiers passer une relance coûteuse.",
  },
  solidaire: {
    label: "Solidaire",
    description: "Se porte plus volontiers au secours d’un leader à protéger lorsque le plan laisse le choix.",
  },
  sociable: {
    label: "Sociable",
    description: "Gagne un point de moral en tissant ses premiers liens avec un compatriote ou un équipier d’une langue commune.",
  },
  ambitieux: {
    label: "Ambitieux",
    description: "Gagne du moral lorsqu’il a réellement sa chance comme leader sur un terrain adapté à ses qualités.",
  },
  colerique: {
    label: "Colérique",
    description: "Perd un point de moral de plus après une contre-performance lorsqu’il était attendu comme leader.",
  },
  charismatique: {
    label: "Charismatique",
    description: "Sa victoire ou son échappée peut rapporter un point de réputation supplémentaire au DS, une fois par course.",
  },
  assidu: {
    label: "Assidu",
    description: "Progresse de 5 % de plus à l’entraînement, dans la limite de ses paliers habituels.",
  },
} as const;

export type RiderPersonalityKey = keyof typeof RIDER_PERSONALITIES;

export function parseRiderPersonalityKey(value: unknown): RiderPersonalityKey | null {
  return typeof value === "string" && Object.hasOwn(RIDER_PERSONALITIES, value)
    ? value as RiderPersonalityKey
    : null;
}
