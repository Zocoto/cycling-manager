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
  { label: string; target: string; success: number; failure: number }
> = {
  victory: { label: "La victoire", target: "Leader 1er", success: 8, failure: -4 },
  podium: { label: "Le podium", target: "Leader dans le top 3", success: 5, failure: -3 },
  top_10: { label: "Le top 10", target: "Leader dans le top 10", success: 3, failure: -2 },
  visibility: { label: "Une place en vue", target: "Leader dans le top 20", success: 2, failure: -1 },
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
  submittedAt: string;
  isOwn: boolean;
};

export type PendingPreRacePressConference = {
  raceEditionId: string;
  raceSlug: string;
  raceName: string;
  startDayNumber: number;
};
