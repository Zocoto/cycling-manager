import type { OfficialRiderResult } from "./race-results";
import { RACE_ROLE_LABELS, type StageSimulationResult } from "./race-simulation";
import type { RaceTeamWorkKind } from "./race-team-work";

export type TeamStageEvent = {
  id: string;
  distanceKm: number;
  endKm?: number;
  title: string;
  detail: string;
  riderIds: string[];
};
export type TeamStageRiderReport = {
  result: OfficialRiderResult;
  role: string | null;
  energyAfter: number | null;
  breakawayKm: number | null;
  relayKm: number | null;
  workKm: Record<RaceTeamWorkKind, number> | null;
};
export type TeamStageReport = {
  teamName: string;
  riders: TeamStageRiderReport[];
  events: TeamStageEvent[];
  tactics: string[];
  hasTimeline: boolean;
  hasWorkRecording: boolean;
};

const WORK_LABELS: Record<RaceTeamWorkKind, string> = {
  protection: "Protection", recovery: "Aide au retour", peloton: "Travail en tête du peloton", leadout: "Lancement du sprint",
};

/** Summarizes only the viewer's team, using the locked scenario and official finish. */
export function buildTeamStageReport({ teamId, stageId, results, simulation }: {
  teamId: string | null;
  stageId: string;
  results: readonly OfficialRiderResult[];
  simulation?: StageSimulationResult | null;
}): TeamStageReport | null {
  if (!teamId) return null;
  const ownResults = results.filter((rider) => rider.teamId === teamId || rider.teamProfileId === teamId);
  if (ownResults.length === 0) return null;
  const recorded = simulation?.stageId === stageId ? simulation : null;
  const ownIds = new Set(ownResults.map((rider) => rider.riderId));
  const names = new Map(ownResults.map((rider) => [rider.riderId, rider.riderName]));
  const resolved = new Map(recorded?.resolvedRiders.map((rider) => [rider.id, rider]) ?? []);
  const finish = new Map(recorded?.results.map((rider) => [rider.riderId, rider]) ?? []);
  const events: TeamStageEvent[] = [];
  const seen = new Set<string>();
  const push = (event: TeamStageEvent) => {
    if (!seen.has(event.id)) { seen.add(event.id); events.push(event); }
  };
  const nameList = (ids: string[]) => ids.map((id) => names.get(id)).filter(Boolean).join(", ");
  const distances = new Map(ownResults.map((rider) => [rider.riderId, { breakaway: 0, relay: 0 }]));
  const frames = recorded?.visualTimeline?.length ? recorded.visualTimeline : recorded?.timeline ?? [];
  let previousKm = 0;
  for (const frame of frames) {
    const delta = Math.max(0, frame.completedDistanceKm - previousKm);
    previousKm = Math.max(previousKm, frame.completedDistanceKm);
    for (const group of frame.groups) {
      if (group.type !== "breakaway") continue;
      for (const id of group.riderIds) {
        const distance = distances.get(id);
        if (distance) distance.breakaway += delta;
      }
    }
    if ("frontDynamics" in frame) {
      for (const id of frame.frontDynamics?.activeRelayRiderIds ?? []) {
        const distance = distances.get(id);
        if (distance) distance.relay += delta;
      }
    }
  }

  const previousGroups = new Map<string, string>();
  for (const snapshot of recorded?.timeline ?? []) {
    const km = snapshot.completedDistanceKm;
    // The last groups are reconciled with finish times, not a timed observation
    // of a rider losing the wheels. Never turn the finish gap into a drop event.
    const isFinish = snapshot === recorded?.timeline.at(-1);
    for (const group of snapshot.groups) {
      for (const id of group.riderIds) {
        if (!ownIds.has(id)) continue;
        const previous = previousGroups.get(id);
        if (group.type !== previous) {
          const label = isFinish ? null : group.type === "breakaway" ? "En échappée"
            : group.type === "chase" ? "En contre-attaque / poursuite"
            : group.type === "dropped" ? "Décrochage"
            : group.type === "peloton" && previous && previous !== "time_trial" ? "Retour dans le peloton" : null;
          if (label) push({ id: `group-${snapshot.segmentNumber}-${id}-${group.type}`, distanceKm: km,
            title: label, detail: `${names.get(id)}${group.gapToLeaderSeconds > 0 ? ` · ${Math.round(group.gapToLeaderSeconds)} s de retard sur la tête de course` : " · dans le groupe de tête"}.`, riderIds: [id] });
        }
        previousGroups.set(id, group.type);
      }
    }
    for (const incident of snapshot.incidents ?? []) {
      const ids = incident.riderIds.filter((id) => ownIds.has(id));
      if (!ids.length) continue;
      const title = incident.type === "puncture" ? "Crevaison / avarie"
        : incident.type === "crosswind" ? "Bordure" : incident.type === "crash_mass" ? "Chute collective" : "Chute";
      const abandoned = incident.abandonedRiderIds.filter((id) => ownIds.has(id));
      push({ id: `incident-${incident.id}`, distanceKm: km, title,
        detail: `${nameList(ids)}.${abandoned.length ? ` Abandon : ${nameList(abandoned)}.` : ""}`, riderIds: ids });
    }
    for (const abandonment of snapshot.abandonments ?? []) {
      if (!ownIds.has(abandonment.riderId)) continue;
      push({ id: `abandon-${abandonment.riderId}`, distanceKm: km, title: "Abandon sur chute",
        detail: `${names.get(abandonment.riderId)} · ${abandonment.injury.label}.`, riderIds: [abandonment.riderId] });
    }
    for (const message of snapshot.commentary ?? []) {
      const ids = [...names].filter(([, name]) => message.includes(name)).map(([id]) => id);
      if (!ids.length) continue;
      const title = /attaqu|offensive|accélération/iu.test(message) ? "Attaque / accélération"
        : /attend|attendre|retour|recoll|réintègre/iu.test(message) ? "Soutien / retour"
        : /lâch|distanc|décroch|cassure|attardés|ne tient pas/iu.test(message) ? "Perte de contact"
        : "Fait de course";
      push({ id: `comment-${snapshot.segmentNumber}-${message}`, distanceKm: km, title, detail: message, riderIds: ids });
    }
  }
  for (const prime of recorded?.primes ?? []) {
    const snapshot = recorded?.timeline.find((item) => item.segmentNumber === prime.segmentNumber);
    for (const classification of prime.classification) {
      if (!ownIds.has(classification.riderId)) continue;
      push({ id: `prime-${prime.segmentNumber}-${classification.riderId}`, distanceKm: snapshot?.completedDistanceKm ?? 0,
        title: prime.prime.type === "mountain" ? "Passage au GPM" : "Sprint intermédiaire",
        detail: `${names.get(classification.riderId)} · ${classification.rank}e · ${classification.points} point(s).`, riderIds: [classification.riderId] });
    }
  }
  const workByRider = new Map(ownResults.map((rider) => [rider.riderId, { protection: 0, recovery: 0, peloton: 0, leadout: 0 }]));
  for (const [index, period] of (recorded?.teamWork ?? []).entries()) {
    if (!ownIds.has(period.riderId)) continue;
    const work = workByRider.get(period.riderId)!;
    work[period.kind] += Math.max(0, period.endKm - period.startKm);
    const targets = period.targetRiderIds.filter((id) => ownIds.has(id));
    push({ id: `work-${index}`, distanceKm: period.startKm, endKm: period.endKm, title: WORK_LABELS[period.kind],
      detail: `${names.get(period.riderId)}${targets.length ? ` pour ${nameList(targets)}` : ""}.`, riderIds: [period.riderId, ...targets] });
  }
  const hasTimeline = Boolean(recorded?.timeline.length);
  return {
    teamName: ownResults[0].teamName,
    hasTimeline,
    hasWorkRecording: recorded?.teamWork !== undefined,
    tactics: (recorded?.tacticalReports ?? []).filter((report) => report.teamId === teamId)
      .map((report) => `${report.summary} ${report.impacts.join(" ")}`),
    events: events.sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id)),
    riders: ownResults.map((result) => ({ result,
      role: resolved.get(result.riderId) ? RACE_ROLE_LABELS[resolved.get(result.riderId)!.role] : null,
      energyAfter: finish.get(result.riderId)?.energyAfter ?? null,
      breakawayKm: hasTimeline ? distances.get(result.riderId)!.breakaway : null,
      relayKm: recorded?.visualTimeline?.some((frame) => frame.frontDynamics) ? distances.get(result.riderId)!.relay : null,
      workKm: recorded?.teamWork !== undefined ? workByRider.get(result.riderId)! : null,
    })),
  };
}
