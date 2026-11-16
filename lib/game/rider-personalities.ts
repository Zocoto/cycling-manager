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
  imprevisible: {
    label: "Imprévisible",
    description: "Peut avoir un léger sursaut ou un petit creux dans un final sur route, au plus une fois par course.",
  },
  fonceur: {
    label: "Fonceur",
    description: "Saisit plus volontiers une occasion de contre-attaquer au prix d’un effort supplémentaire.",
  },
  cooperatif: {
    label: "Coopératif",
    description: "Prend plus volontiers sa part des relais dans une échappée ou un gruppetto.",
  },
  metronome: {
    label: "Régulier",
    description: "Cadence plus régulièrement ses relais en chrono par équipes pour aider son groupe à rester ensemble.",
  },
  tenace: {
    label: "Tenace",
    description: "Prolonge un peu son effort pour recoller tant que la jonction reste à portée.",
  },
  prudent: {
    label: "Prudent",
    description: "Se ménage une marge dans les descentes sur route mouillée, quitte à céder quelques longueurs.",
  },
  fidele: {
    label: "Fidèle",
    description: "Apprécie particulièrement une prolongation et vit moins bien un départ après plusieurs saisons dans le même club.",
  },
  mentor: {
    label: "Mentor",
    description: "Gagne du moral lorsqu’un jeune qu’il a aidé en course signe son premier top 10.",
  },
  collectif: {
    label: "Collectif",
    description: "Tire davantage de satisfaction de la victoire d’un équipier lorsqu’il a contribué à sa course.",
  },
  globe_trotteur: {
    label: "Globe-trotteur",
    description: "Gagne du moral en courant dans un pays qu’il découvre, avec un nombre limité de bonus par saison.",
  },
  meticuleux: {
    label: "Méticuleux",
    description: "Apprécie de prendre le départ d’une course dont il a reconnu le parcours.",
  },
  perfectionniste: {
    label: "Perfectionniste",
    description: "Apprécie de franchir un palier et se lasse de répéter le même entraînement quand il a atteint ses plafonds.",
  },
  force_tranquille: {
    label: "Force tranquille",
    description: "Encaisse plus sereinement une contre-performance et perd un point de moral de moins.",
  },
  discret: {
    label: "Discret",
    description: "Apprécie qu’un débrief difficile se fasse en privé et vit moins bien une mise en cause publique.",
  },
  franc_parleur: {
    label: "Franc-parleur",
    description: "Apprécie que son DS reconnaisse franchement ses erreurs de stratégie en zone mixte.",
  },
  chambreur: {
    label: "Chambreur",
    description: "Une pique adressée à un rival en zone mixte peut rapporter un peu plus de réputation ou mal retomber.",
  },
} as const;

export type RiderPersonalityKey = keyof typeof RIDER_PERSONALITIES;

export function parseRiderPersonalityKey(value: unknown): RiderPersonalityKey | null {
  return typeof value === "string" && Object.hasOwn(RIDER_PERSONALITIES, value)
    ? value as RiderPersonalityKey
    : null;
}
