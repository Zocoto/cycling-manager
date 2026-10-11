export const PRE_RACE_AMBITIONS = [
  "victory",
  "podium",
  "top_10",
  "visibility",
] as const;

export type PreRaceAmbition = (typeof PRE_RACE_AMBITIONS)[number];

export const PRE_RACE_INTENTS = [
  "control",
  "attack",
  "sprint",
  "development",
] as const;

export type PreRaceIntent = (typeof PRE_RACE_INTENTS)[number];

export const PRE_RACE_AMBITION_DETAILS: Record<
  PreRaceAmbition,
  { label: string; target: string; success: number; failure: number; partial: string }
> = {
  victory: { label: "La victoire", target: "Leader 1er", success: 8, failure: -4, partial: "40 % : 2e–3e · 20 % : 4e–5e" },
  podium: { label: "Le podium", target: "Leader dans le top 3", success: 5, failure: -3, partial: "40 % : 4e–5e · 20 % : 6e–10e" },
  top_10: { label: "Le top 10", target: "Leader dans le top 10", success: 3, failure: -2, partial: "40 % : 11e–15e · 20 % : 16e–20e" },
  visibility: { label: "Une place en vue", target: "Leader dans le top 20", success: 2, failure: -1, partial: "40 % : 21e–25e · 20 % : 26e–30e" },
};

export const PRE_RACE_INTENT_LABELS: Record<PreRaceIntent, string> = {
  control: "Contrôler la course",
  attack: "Courir à l’attaque",
  sprint: "Miser sur le final",
  development: "Faire grandir le collectif",
};

export function isPreRaceAmbition(value: string): value is PreRaceAmbition {
  return PRE_RACE_AMBITIONS.includes(value as PreRaceAmbition);
}

export function isPreRaceIntent(value: string): value is PreRaceIntent {
  return PRE_RACE_INTENTS.includes(value as PreRaceIntent);
}

export type PreRacePressConference = {
  id: string;
  teamName: string;
  directorName: string;
  leaderRiderId: string;
  leaderName: string;
  ambition: PreRaceAmbition;
  raceIntent: PreRaceIntent;
  publicStatement: string;
  status: "published" | "settled";
  targetMet: boolean | null;
  leaderFinalRank: number | null;
  reputationDelta: number | null;
  commitmentAmount: number;
  sponsorBonus: number;
  achievementLevel?: "full" | "partial" | "missed" | null;
  achievementPercent?: number;
  sponsorBonusAwarded?: number;
  submittedAt: string;
  isOwn: boolean;
};

export type PendingPreRacePressConference = {
  raceEditionId: string;
  raceSlug: string;
  raceName: string;
  startDayNumber: number;
};

export type PreRaceRivalryPrompt = {
  rivalTeamName: string;
  rivalDirectorName: string;
  ownScore: number;
  rivalScore: number;
  pairingReason: string;
};
