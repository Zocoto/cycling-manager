export const RIDER_PERSONALITIES = {
  franc_tireur: {
    label: "Franc-tireur",
    description: "Attaque plus volontiers en solitaire et gère mieux son effort seul à l’avant.",
  },
  opportuniste: {
    label: "Opportuniste",
    description: "Suit volontiers les attaques adverses pour saisir sa chance.",
  },
  calculateur: {
    label: "Calculateur",
    description: "Économise ses forces et évite les relances trop coûteuses.",
  },
  solidaire: {
    label: "Solidaire",
    description: "Aide volontiers son leader lorsqu’il est en difficulté.",
  },
  sociable: {
    label: "Sociable",
    description: "Gagne du moral en nouant ses premiers liens avec un équipier de même nationalité ou langue.",
  },
  ambitieux: {
    label: "Ambitieux",
    description: "Gagne du moral quand il peut jouer sa chance comme leader sur son terrain.",
  },
  colerique: {
    label: "Colérique",
    description: "Supporte mal les contre-performances lorsqu’il mène l’équipe.",
  },
  charismatique: {
    label: "Charismatique",
    description: "Ses victoires et échappées peuvent renforcer la réputation de son DS.",
  },
  assidu: {
    label: "Assidu",
    description: "Progresse plus vite à l’entraînement.",
  },
  imprevisible: {
    label: "Imprévisible",
    description: "Peut se surpasser ou connaître un petit creux dans le final.",
  },
  fonceur: {
    label: "Fonceur",
    description: "Contre-attaque volontiers, au prix d’un effort plus intense.",
  },
  cooperatif: {
    label: "Coopératif",
    description: "Prend volontiers ses relais pour faire avancer son groupe.",
  },
  metronome: {
    label: "Régulier",
    description: "Régularise ses relais pour aider son équipe à rester groupée en chrono.",
  },
  tenace: {
    label: "Tenace",
    description: "Insiste dans la poursuite tant qu’il peut encore recoller.",
  },
  prudent: {
    label: "Prudent",
    description: "Réduit les risques en descente mouillée, quitte à perdre un peu de temps.",
  },
  fidele: {
    label: "Fidèle",
    description: "Apprécie les prolongations et vit moins bien un départ après un long passage au club.",
  },
  mentor: {
    label: "Mentor",
    description: "Gagne du moral en aidant un jeune équipier à réussir sa première belle course.",
  },
  collectif: {
    label: "Collectif",
    description: "Gagne du moral quand il contribue à la victoire d’un équipier.",
  },
  globe_trotteur: {
    label: "Globe-trotteur",
    description: "Gagne du moral en découvrant de nouveaux pays en course.",
  },
  meticuleux: {
    label: "Méticuleux",
    description: "Gagne du moral quand il a reconnu le parcours avant de courir.",
  },
  perfectionniste: {
    label: "Perfectionniste",
    description: "Apprécie de progresser et se frustre quand il répète un entraînement sans marge de progression.",
  },
  force_tranquille: {
    label: "Force tranquille",
    description: "Garde mieux le moral après un résultat décevant.",
  },
  discret: {
    label: "Discret",
    description: "Préfère les débriefs en privé et supporte mal les critiques publiques.",
  },
  franc_parleur: {
    label: "Franc-parleur",
    description: "Apprécie que son DS assume ses erreurs de stratégie devant la presse.",
  },
  chambreur: {
    label: "Chambreur",
    description: "Ses piques envers un rival peuvent plaire ou se retourner contre son équipe.",
  },
} as const;

export type RiderPersonalityKey = keyof typeof RIDER_PERSONALITIES;

export function parseRiderPersonalityKey(value: unknown): RiderPersonalityKey | null {
  return typeof value === "string" && Object.hasOwn(RIDER_PERSONALITIES, value)
    ? value as RiderPersonalityKey
    : null;
}
