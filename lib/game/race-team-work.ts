export type RaceTeamWorkKind = "protection" | "recovery" | "peloton" | "leadout";

export type RaceTeamWorkPeriod = {
  riderId: string;
  kind: RaceTeamWorkKind;
  targetRiderIds: string[];
  startKm: number;
  endKm: number;
};

/** Observes the engine's actual work flags, without touching sporting state. */
export function createRaceTeamWorkRecorder() {
  const periods: RaceTeamWorkPeriod[] = [];
  const latest = new Map<string, RaceTeamWorkPeriod>();
  return {
    periods,
    record(period: RaceTeamWorkPeriod) {
      const targetRiderIds = [...new Set(period.targetRiderIds)].sort();
      const key = JSON.stringify([period.riderId, period.kind, targetRiderIds]);
      const previous = latest.get(key);
      if (previous && Math.abs(previous.endKm - period.startKm) < 0.00001) {
        previous.endKm = period.endKm;
      } else {
        const next = { ...period, targetRiderIds };
        periods.push(next);
        latest.set(key, next);
      }
    },
  };
}
