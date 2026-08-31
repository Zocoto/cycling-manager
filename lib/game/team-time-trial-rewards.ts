export const TEAM_TIME_TRIAL_TEAM_REWARD_CUTOFF_AT =
  "2026-09-01T00:00:00+02:00";

/**
 * Les TTT déjà disputés conservent leur règlement historique. La bascule ne
 * concerne que les étapes prenant leur départ à compter du 1er septembre 2026.
 */
export function shouldRewardTeamTimeTrialByTeam(
  departureAt: string | null | undefined,
) {
  if (!departureAt) return false;

  const departureTimestamp = Date.parse(departureAt);
  return (
    Number.isFinite(departureTimestamp) &&
    departureTimestamp >= Date.parse(TEAM_TIME_TRIAL_TEAM_REWARD_CUTOFF_AT)
  );
}
