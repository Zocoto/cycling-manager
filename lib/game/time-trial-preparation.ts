export const TIME_TRIAL_EFFORT_MODES = [
  "conserve",
  "normal",
  "all_in",
] as const;

export type TimeTrialEffortMode = (typeof TIME_TRIAL_EFFORT_MODES)[number];

export type TimeTrialRiderPlan = {
  effortMode: TimeTrialEffortMode;
  relaySharePct: number | null;
};

export const DEFAULT_TIME_TRIAL_RIDER_PLAN: TimeTrialRiderPlan = {
  effortMode: "normal",
  relaySharePct: null,
};

export const TIME_TRIAL_EFFORT_LABELS: Record<TimeTrialEffortMode, string> = {
  conserve: "S’économiser",
  normal: "Rythme normal",
  all_in: "Tout donner",
};

export const TIME_TRIAL_EFFORT_DESCRIPTIONS: Record<
  TimeTrialEffortMode,
  string
> = {
  conserve: "Un chrono plus prudent pour limiter la perte de forme.",
  normal: "Le meilleur compromis entre performance et récupération.",
  all_in: "Un gain chronométrique au prix d’une forte dépense de forme.",
};

export const TIME_TRIAL_EFFORT_EFFECTS: Record<
  TimeTrialEffortMode,
  {
    paceMultiplier: number;
    energyCostMultiplier: number;
    formCostMultiplier: number;
  }
> = {
  conserve: {
    paceMultiplier: 0.975,
    energyCostMultiplier: 0.7,
    formCostMultiplier: 0.7,
  },
  normal: {
    paceMultiplier: 1,
    energyCostMultiplier: 1,
    formCostMultiplier: 1,
  },
  all_in: {
    paceMultiplier: 1.018,
    energyCostMultiplier: 1.4,
    formCostMultiplier: 1.35,
  },
};

export function isTimeTrialEffortMode(
  value: unknown,
): value is TimeTrialEffortMode {
  return TIME_TRIAL_EFFORT_MODES.includes(value as TimeTrialEffortMode);
}

export function getDefaultTeamTimeTrialRelayShares(riderIds: string[]) {
  if (riderIds.length === 0) return {};

  const baseShare = Math.floor(100 / riderIds.length);
  let remainder = 100 - baseShare * riderIds.length;

  return Object.fromEntries(
    riderIds.map((riderId) => {
      const share = baseShare + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      return [riderId, share];
    }),
  );
}
