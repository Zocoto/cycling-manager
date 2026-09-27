export const REPUTATION_FEATURE_START_GAME_YEAR = 4;

export const REPUTATION_TIERS = [
  { minimum: 0, label: "Amateur" },
  { minimum: 30, label: "Prometteur" },
  { minimum: 75, label: "Reconnu" },
  { minimum: 200, label: "Établi" },
  { minimum: 400, label: "Référence" },
  { minimum: 750, label: "Élite" },
  { minimum: 1_000, label: "Icône" },
  { minimum: 1_250, label: "Institution" },
  { minimum: 1_500, label: "Légende" },
] as const;

export const REPUTATION_FEATURE_THRESHOLDS = {
  reinforcedPress: 400,
  wildcardSupport: 750,
  sponsorInvestment: 1_000,
  equipmentPartnerExtra: 1_250,
} as const;

export const PRESS_REPUTATION_COMMITMENTS = [
  {
    amount: 0,
    sponsorBonus: 0,
    label: "Sans renfort",
    description: "La conférence conserve ses gains et pertes habituels.",
  },
  {
    amount: 15,
    sponsorBonus: 1,
    label: "Engagement mesuré",
    description: "15 points réservés ; rendus si l’objectif est atteint, perdus sinon.",
  },
  {
    amount: 35,
    sponsorBonus: 2,
    label: "Engagement fort",
    description: "35 points réservés ; rendus si l’objectif est atteint, perdus sinon.",
  },
  {
    amount: 60,
    sponsorBonus: 4,
    label: "Engagement total",
    description: "60 points réservés ; rendus si l’objectif est atteint, perdus sinon.",
  },
] as const;

export const WILDCARD_REPUTATION_COMMITMENTS = [
  {
    amount: 0,
    selectionBonus: 0,
    label: "Candidature simple",
    description: "Votre dossier est évalué sans appui supplémentaire.",
  },
  {
    amount: 25,
    selectionBonus: 30,
    label: "Appui mesuré",
    description: "25 points réservés pour renforcer le dossier, sans garantir l’invitation.",
  },
  {
    amount: 50,
    selectionBonus: 65,
    label: "Appui fort",
    description: "50 points réservés pour renforcer le dossier, sans garantir l’invitation.",
  },
  {
    amount: 75,
    selectionBonus: 105,
    label: "Appui prioritaire",
    description: "75 points réservés pour renforcer le dossier, sans garantir l’invitation.",
  },
] as const;

export const SPONSOR_REPUTATION_INVESTMENTS = [
  {
    cost: 0,
    budgetBonusPercent: 0,
    label: "Contrat standard",
  },
  {
    cost: 50,
    budgetBonusPercent: 5,
    label: "Levier commercial",
  },
  {
    cost: 100,
    budgetBonusPercent: 10,
    label: "Partenariat premium",
  },
] as const;

export const EQUIPMENT_PARTNER_EXTRA_COST = 200;

export type ReputationTier = (typeof REPUTATION_TIERS)[number];

export function isReputationFeatureEnabled(gameYear: number) {
  return gameYear >= REPUTATION_FEATURE_START_GAME_YEAR;
}

export function getReputationTier(points: number): ReputationTier {
  const safePoints = Math.max(0, Number.isFinite(points) ? points : 0);

  return [...REPUTATION_TIERS]
    .reverse()
    .find((tier) => safePoints >= tier.minimum) ?? REPUTATION_TIERS[0];
}

export function getNextReputationTier(points: number): ReputationTier | null {
  const safePoints = Math.max(0, Number.isFinite(points) ? points : 0);
  return REPUTATION_TIERS.find((tier) => tier.minimum > safePoints) ?? null;
}

export function getAvailableReputation(
  currentPoints: number,
  committedPoints: number,
) {
  return Math.max(0, roundPoints(currentPoints) - roundPoints(committedPoints));
}

export function getPressReputationCommitment(amount: number) {
  return PRESS_REPUTATION_COMMITMENTS.find((option) => option.amount === amount) ?? null;
}

export function getWildcardReputationCommitment(amount: number) {
  return WILDCARD_REPUTATION_COMMITMENTS.find((option) => option.amount === amount) ?? null;
}

export function getSponsorReputationInvestment(cost: number) {
  return SPONSOR_REPUTATION_INVESTMENTS.find((option) => option.cost === cost) ?? null;
}

function roundPoints(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
