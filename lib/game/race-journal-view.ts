import type { TeamStageEvent, TeamStageReport } from "./race-team-stage-report";

export const RACE_JOURNAL_VIEW_STORAGE_KEY = "cyclostratege:race-journal-view:v1";
export const TEAM_JOURNAL_MAX_EVENTS = 26;
export type RaceJournalView = "race" | "team";

export function resolveRaceJournalView(preferred: unknown, hasRace: boolean, hasTeam: boolean): RaceJournalView {
  if (!hasRace && hasTeam) return "team";
  return preferred === "team" && hasTeam ? "team" : "race";
}

/** Presentation only: no scenario traversal, result changes or reward writes. */
export function buildTeamJournalView(report: TeamStageReport) {
  const riderNames = new Map(report.riders.map(rider => [rider.result.riderId, rider.result.riderName]));
  const eventsByRider = new Map(report.riders.map(rider => [rider.result.riderId, [] as TeamStageEvent[]]));
  const seen = new Set<string>();
  const events: TeamStageEvent[] = [];
  for (const event of report.events) {
    if (seen.has(event.id) || !Number.isFinite(event.distanceKm)) continue;
    const ownIds = [...new Set(event.riderIds)].filter(id => eventsByRider.has(id));
    if (!ownIds.length) continue;
    seen.add(event.id);
    events.push(event);
    for (const id of ownIds) eventsByRider.get(id)!.push(event);
  }
  const chronological = (a: TeamStageEvent, b: TeamStageEvent) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id);
  const priority = (event: TeamStageEvent) => event.id.startsWith("abandon-") ? 100
    : event.id.startsWith("incident-") ? 90 : event.id.startsWith("prime-") ? 80
      : event.id.startsWith("work-") ? 65 : 50;
  // Bound the overview, but keep every recorded own event in the rider details.
  const overview = events.length <= TEAM_JOURNAL_MAX_EVENTS ? [...events]
    : [...events].sort((a, b) => priority(b) - priority(a) || chronological(a, b)).slice(0, TEAM_JOURNAL_MAX_EVENTS);
  overview.sort(chronological);
  for (const riderEvents of eventsByRider.values()) riderEvents.sort(chronological);
  const finished = report.riders.filter(rider => rider.result.status === "finished");
  const best = finished.reduce<(typeof report.riders)[number] | null>((best, rider) => {
    const rank = rider.result.rank;
    return rank !== null && rank > 0 && Number.isFinite(rank) && (best === null || rank < best.result.rank!) ? rider : best;
  }, null);
  return { overview, eventCount: events.length, eventsByRider, riderNames, best, finishedCount: finished.length };
}
