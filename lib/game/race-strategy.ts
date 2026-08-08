export const RACE_STRATEGY_OBJECTIVES = [
  "balanced",
  "stage_win",
  "general_classification",
  "sprint",
  "mountain_points",
  "breakaway",
] as const;

export type RaceStrategyObjective =
  (typeof RACE_STRATEGY_OBJECTIVES)[number];

export const RACE_STRATEGY_OBJECTIVE_LABELS: Record<
  RaceStrategyObjective,
  string
> = {
  balanced: "Course équilibrée",
  stage_win: "Victoire d’étape",
  general_classification: "Classement général",
  sprint: "Préparer le sprint",
  mountain_points: "Classement montagne",
  breakaway: "Viser l’échappée",
};

export const RACE_COLLECTIVE_POSTURES = [
  "conservative",
  "balanced",
  "aggressive",
] as const;

export type RaceCollectivePosture =
  (typeof RACE_COLLECTIVE_POSTURES)[number];

export const RACE_COLLECTIVE_POSTURE_LABELS: Record<
  RaceCollectivePosture,
  string
> = {
  conservative: "Économiser l’équipe",
  balanced: "Rester adaptable",
  aggressive: "Durcir la course",
};

export const RACE_BREAKAWAY_POLICIES = [
  "avoid",
  "opportunistic",
  "target",
] as const;

export type RaceBreakawayPolicy =
  (typeof RACE_BREAKAWAY_POLICIES)[number];

export const RACE_BREAKAWAY_POLICY_LABELS: Record<
  RaceBreakawayPolicy,
  string
> = {
  avoid: "Ne pas gaspiller d’énergie",
  opportunistic: "Saisir une bonne occasion",
  target: "Placer un coureur devant",
};

export const RACE_CHASE_POLICIES = [
  "never",
  "dangerous_breakaway",
  "protect_lead",
  "always",
] as const;

export type RaceChasePolicy = (typeof RACE_CHASE_POLICIES)[number];

export const RACE_CHASE_POLICY_LABELS: Record<RaceChasePolicy, string> = {
  never: "Ne pas prendre la poursuite",
  dangerous_breakaway: "Rouler si l’échappée devient dangereuse",
  protect_lead: "Défendre le leader ou le maillot",
  always: "Contrôler la course",
};

export const RACE_ATTACK_INTENSITIES = [
  "measured",
  "strong",
  "all_in",
] as const;

export type RaceAttackIntensity =
  (typeof RACE_ATTACK_INTENSITIES)[number];

export const RACE_ATTACK_INTENSITY_LABELS: Record<
  RaceAttackIntensity,
  string
> = {
  measured: "Attaque mesurée",
  strong: "Attaque franche",
  all_in: "Tout donner",
};

export const RACE_ATTACK_CONDITIONS = [
  "always",
  "high_energy",
  "leader_isolated",
  "gc_threat",
] as const;

export type RaceAttackCondition =
  (typeof RACE_ATTACK_CONDITIONS)[number];

export const RACE_ATTACK_CONDITION_LABELS: Record<
  RaceAttackCondition,
  string
> = {
  always: "Dès que le tronçon est atteint",
  high_energy: "Seulement avec assez d’énergie",
  leader_isolated: "Si les leaders sont isolés",
  gc_threat: "Si la situation au général l’exige",
};

export const MAX_RACE_ATTACK_ORDERS = 2;

export type RaceAttackOrder = {
  riderId: string;
  segmentNumber: number;
  intensity: RaceAttackIntensity;
  condition: RaceAttackCondition;
};

export type RiderRaceDuty =
  | "lieutenant"
  | "danger_pacer"
  | "protector"
  | "breakaway_candidate";

export type RaceTeamStrategy = {
  teamId: string;
  objective: RaceStrategyObjective;
  collectivePosture: RaceCollectivePosture;
  breakawayPolicy: RaceBreakawayPolicy;
  chasePolicy: RaceChasePolicy;
  lieutenantRiderId: string | null;
  dangerPacerRiderId: string | null;
  protectorRiderId: string | null;
  breakawayRiderId: string | null;
  attackOrders: RaceAttackOrder[];
};

export const DEFAULT_RACE_TEAM_STRATEGY = {
  objective: "balanced",
  collectivePosture: "balanced",
  breakawayPolicy: "opportunistic",
  chasePolicy: "dangerous_breakaway",
  lieutenantRiderId: null,
  dangerPacerRiderId: null,
  protectorRiderId: null,
  breakawayRiderId: null,
  attackOrders: [],
} as const satisfies Omit<RaceTeamStrategy, "teamId">;

export function getRiderRaceDuty(
  strategy: RaceTeamStrategy | undefined,
  riderId: string,
): RiderRaceDuty | null {
  if (!strategy) return null;
  if (strategy.lieutenantRiderId === riderId) return "lieutenant";
  if (strategy.dangerPacerRiderId === riderId) return "danger_pacer";
  if (strategy.protectorRiderId === riderId) return "protector";
  if (strategy.breakawayRiderId === riderId) return "breakaway_candidate";
  return null;
}

export function isRaceStrategyValue<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.includes(value as T);
}
