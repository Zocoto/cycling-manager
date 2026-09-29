import type {
  RaceIncident,
  RaceIncidentType,
  RaceTimelineSnapshot,
  RiderSimulationInput,
  StageSimulationResult,
} from "./race-simulation";

export const RACE_COURSE_JOURNAL_MAX_ENTRIES = 26;

export type RaceCourseJournalEntryKind =
  | "start"
  | "breakaway"
  | "gap"
  | "junction"
  | "attack"
  | "incident"
  | "selection"
  | "finish";

export type RaceCourseJournalEntry = {
  id: string;
  kind: RaceCourseJournalEntryKind;
  distanceKm: number;
  title: string;
  detail: string;
};

type JournalCandidate = RaceCourseJournalEntry & {
  priority: number;
  sequence: number;
};

type BreakawayEpisode = {
  snapshots: RaceTimelineSnapshot[];
  riderAppearances: Map<string, number>;
  caughtAt: RaceTimelineSnapshot | null;
};

const IMPORTANT_JUNCTION_PATTERN =
  /fusionnent|recoll(?:e|ent)|rejoint(?: la tête| le groupe)|réintègre|rattrap(?:e|ent)/iu;
const LATE_ATTACK_PATTERN =
  /place une attaque|attaque dans le final|accélération|impose son rythme|prolonge son attaque|offensive décisive/iu;

export function buildRaceCourseJournal({
  simulation,
}: {
  simulation: StageSimulationResult;
}): RaceCourseJournalEntry[] {
  const riderById = new Map(
    simulation.resolvedRiders.map((rider) => [rider.id, rider]),
  );
  const totalDistanceKm =
    simulation.timeline.at(-1)?.completedDistanceKm ?? 0;
  const candidates: JournalCandidate[] = [];
  let sequence = 0;

  const push = ({
    kind,
    distanceKm,
    title,
    detail,
    priority,
  }: Omit<JournalCandidate, "id" | "sequence">) => {
    sequence += 1;
    candidates.push({
      id: `course-journal-${kind}-${Math.round(distanceKm * 10)}-${sequence}`,
      kind,
      distanceKm,
      title,
      detail,
      priority,
      sequence,
    });
  };

  push({
    kind: "start",
    distanceKm: 0,
    title: "Départ",
    detail: `${simulation.resolvedRiders.length} coureurs prennent le départ.`,
    priority: 100,
  });

  for (const episode of getBreakawayEpisodes(simulation.timeline)) {
    const firstSnapshot = episode.snapshots[0];
    if (!firstSnapshot) continue;
    const principalRiderIds = [...episode.riderAppearances.entries()]
      .sort(
        (first, second) =>
          second[1] - first[1] || first[0].localeCompare(second[0]),
      )
      .map(([riderId]) => riderId);

    push({
      kind: "breakaway",
      distanceKm: firstSnapshot.completedDistanceKm,
      title: "Échappée",
      detail: `Une échappée de ${principalRiderIds.length} coureur${principalRiderIds.length > 1 ? "s" : ""} se forme : ${formatRiderNames(principalRiderIds, riderById, 6)}.`,
      priority: 84,
    });

    const peak = getBreakawayPeakGap(episode.snapshots);
    if (peak && peak.gapSeconds >= 20) {
      push({
        kind: "gap",
        distanceKm: peak.snapshot.completedDistanceKm,
        title: "Écart maximal",
        detail: `L’échappée porte son avance à ${formatGap(peak.gapSeconds)}.`,
        priority: 72,
      });
    }

    if (episode.caughtAt) {
      push({
        kind: "junction",
        distanceKm: episode.caughtAt.completedDistanceKm,
        title: "Échappée reprise",
        detail: "Le peloton reprend les derniers échappés et se regroupe.",
        priority: 86,
      });
    }
  }

  const junctions = simulation.timeline.flatMap((snapshot) =>
    (snapshot.commentary ?? [])
      .filter(
        (message) =>
          IMPORTANT_JUNCTION_PATTERN.test(message) &&
          !/échappée est reprise|de nouveau groupé/iu.test(message),
      )
      .map((message) => ({ snapshot, message })),
  );
  for (const { snapshot, message } of selectEvenly(junctions, 4)) {
    push({
      kind: "junction",
      distanceKm: snapshot.completedDistanceKm,
      title: "Jonction",
      detail: polishCommentary(message),
      priority: 64,
    });
  }

  const lateAttackThresholdKm = totalDistanceKm * 0.68;
  const lateAttacks = simulation.timeline.flatMap((snapshot) =>
    snapshot.completedDistanceKm < lateAttackThresholdKm
      ? []
      : (snapshot.commentary ?? [])
          .filter(Boolean)
          .filter((message) => LATE_ATTACK_PATTERN.test(message))
          .map((message) => ({ snapshot, message })),
  );
  for (const { snapshot, message } of selectEvenly(lateAttacks, 5)) {
    push({
      kind: "attack",
      distanceKm: snapshot.completedDistanceKm,
      title: "Offensive dans le final",
      detail: polishCommentary(message),
      priority: 91,
    });
  }

  const incidentEvents = simulation.timeline.flatMap((snapshot) =>
    (snapshot.incidents ?? []).map((incident) => ({ snapshot, incident })),
  );
  for (const { snapshot, incident } of selectImportantIncidents(
    incidentEvents,
    6,
  )) {
    const riderNames = formatRiderNames(incident.riderIds, riderById, 5);
    const abandonedNames = formatRiderNames(
      incident.abandonedRiderIds,
      riderById,
      4,
    );
    push({
      kind: "incident",
      distanceKm: snapshot.completedDistanceKm,
      title: getIncidentTitle(incident.type),
      detail: `${getIncidentDetail(incident.type, riderNames)}${incident.abandonedRiderIds.length > 0 ? ` ${abandonedNames} abandonne${incident.abandonedRiderIds.length > 1 ? "nt" : ""}.` : ""}`,
      priority:
        incident.type === "crash_mass" ||
        incident.type === "crash_individual"
          ? 96
          : 88,
    });
  }

  const finalSnapshot = simulation.timeline.at(-1);
  if (finalSnapshot && (finalSnapshot.groups ?? []).length > 1) {
    const leadingGroupSize = finalSnapshot.groups?.[0]?.riderIds.length ?? 0;
    push({
      kind: "selection",
      distanceKm: finalSnapshot.completedDistanceKm,
      title: "Sélection à l’arrivée",
      detail:
        leadingGroupSize <= 1
          ? "La sélection fait exploser la course : le vainqueur franchit la ligne seul."
          : `Un groupe de tête de ${leadingGroupSize} coureurs se présente pour la victoire.`,
      priority: 79,
    });
  }

  const winner = simulation.results.find(
    (result) => result.status === "finished" && result.rank === 1,
  );
  const runnerUp = simulation.results.find(
    (result) => result.status === "finished" && result.rank === 2,
  );
  if (winner) {
    const winnerRider = riderById.get(winner.riderId);
    const runnerUpRider = runnerUp
      ? (riderById.get(runnerUp.riderId) ?? null)
      : null;
    push({
      kind: "finish",
      distanceKm: totalDistanceKm,
      title: "Victoire",
      detail: formatVictory({
        winner,
        winnerRider,
        runnerUp,
        runnerUpRider,
      }),
      priority: 110,
    });
  }

  const uniqueCandidates = deduplicateCandidates(candidates);
  const retained =
    uniqueCandidates.length <= RACE_COURSE_JOURNAL_MAX_ENTRIES
      ? uniqueCandidates
      : [...uniqueCandidates]
          .sort(
            (first, second) =>
              second.priority - first.priority ||
              first.sequence - second.sequence,
          )
          .slice(0, RACE_COURSE_JOURNAL_MAX_ENTRIES);

  return retained
    .sort(
      (first, second) =>
        first.distanceKm - second.distanceKm ||
        first.sequence - second.sequence,
    )
    .map((candidate) => ({
      id: candidate.id,
      kind: candidate.kind,
      distanceKm: candidate.distanceKm,
      title: candidate.title,
      detail: candidate.detail,
    }));
}

function getBreakawayEpisodes(
  timeline: readonly RaceTimelineSnapshot[],
): BreakawayEpisode[] {
  const episodes: BreakawayEpisode[] = [];
  let active: BreakawayEpisode | null = null;
  let previousRiderIds = new Set<string>();

  const closeActiveEpisode = (caughtAt: RaceTimelineSnapshot | null) => {
    if (!active) return;
    active.caughtAt = caughtAt;
    episodes.push(active);
    active = null;
    previousRiderIds = new Set<string>();
  };

  for (const snapshot of timeline) {
    const riderIds = new Set(
      (snapshot.groups ?? [])
        .filter((group) => group.type === "breakaway")
        .flatMap((group) => group.riderIds),
    );
    if (riderIds.size === 0) {
      closeActiveEpisode(snapshot);
      continue;
    }

    const sharedRiderCount = [...riderIds].filter((riderId) =>
      previousRiderIds.has(riderId),
    ).length;
    const sameEpisode =
      active !== null &&
      sharedRiderCount >=
        Math.max(
          1,
          Math.min(riderIds.size, previousRiderIds.size) * 0.35,
        );
    if (!sameEpisode) {
      closeActiveEpisode(null);
      active = {
        snapshots: [],
        riderAppearances: new Map<string, number>(),
        caughtAt: null,
      };
    }

    active!.snapshots.push(snapshot);
    for (const riderId of riderIds) {
      active!.riderAppearances.set(
        riderId,
        (active!.riderAppearances.get(riderId) ?? 0) + 1,
      );
    }
    previousRiderIds = riderIds;
  }

  closeActiveEpisode(null);
  return episodes.slice(0, 3);
}

function getBreakawayPeakGap(snapshots: readonly RaceTimelineSnapshot[]) {
  let peak: { snapshot: RaceTimelineSnapshot; gapSeconds: number } | null =
    null;

  for (const snapshot of snapshots) {
    const breakawayGap = Math.min(
      ...(snapshot.groups ?? [])
        .filter((group) => group.type === "breakaway")
        .map((group) => group.gapToLeaderSeconds),
    );
    const pelotonGap = Math.min(
      ...(snapshot.groups ?? [])
        .filter((group) => group.type === "peloton")
        .map((group) => group.gapToLeaderSeconds),
    );
    if (!Number.isFinite(breakawayGap) || !Number.isFinite(pelotonGap)) {
      continue;
    }
    const gapSeconds = Math.max(0, pelotonGap - breakawayGap);
    if (!peak || gapSeconds > peak.gapSeconds) {
      peak = { snapshot, gapSeconds };
    }
  }

  return peak;
}

function selectImportantIncidents(
  incidents: readonly {
    snapshot: RaceTimelineSnapshot;
    incident: RaceIncident;
  }[],
  maximumCount: number,
) {
  return [...incidents]
    .sort(
      (first, second) =>
        getIncidentPriority(second.incident.type) -
        getIncidentPriority(first.incident.type),
    )
    .slice(0, maximumCount)
    .sort(
      (first, second) =>
        first.snapshot.completedDistanceKm -
        second.snapshot.completedDistanceKm,
    );
}

function getIncidentPriority(type: RaceIncidentType) {
  if (type === "crash_mass") return 4;
  if (type === "crash_individual") return 3;
  if (type === "crosswind") return 2;
  return 1;
}

function getIncidentTitle(type: RaceIncidentType) {
  if (type === "crash_mass") return "Chute collective";
  if (type === "crash_individual") return "Chute";
  if (type === "crosswind") return "Bordure";
  return "Avarie mécanique";
}

function getIncidentDetail(type: RaceIncidentType, riderNames: string) {
  if (type === "crash_mass") return `${riderNames} sont pris dans une chute collective.`;
  if (type === "crash_individual") return `${riderNames} chute et repart avec du retard.`;
  if (type === "crosswind") return `${riderNames} sont piégés par une bordure.`;
  return `Crevaison pour ${riderNames}, contraint de chasser.`;
}

function formatVictory({
  winner,
  winnerRider,
  runnerUp,
  runnerUpRider,
}: {
  winner: StageSimulationResult["results"][number];
  winnerRider: RiderSimulationInput | undefined;
  runnerUp: StageSimulationResult["results"][number] | undefined;
  runnerUpRider: RiderSimulationInput | null;
}) {
  const winnerName = winnerRider?.name ?? winner.riderId;
  const teamSuffix = winnerRider?.teamName ? ` (${winnerRider.teamName})` : "";
  if (!runnerUp) return `${winnerName}${teamSuffix} remporte la course.`;

  const runnerUpName = runnerUpRider?.name ?? runnerUp.riderId;
  const gapSeconds = Math.max(0, runnerUp.gapToWinnerSeconds);
  return gapSeconds >= 1
    ? `${winnerName}${teamSuffix} s’impose avec ${formatGap(gapSeconds)} d’avance sur ${runnerUpName}.`
    : `${winnerName}${teamSuffix} devance ${runnerUpName} sur la ligne et remporte la course.`;
}

function formatRiderNames(
  riderIds: readonly string[],
  riderById: ReadonlyMap<string, RiderSimulationInput>,
  maximumNames: number,
) {
  const names = [...new Set(riderIds)].map(
    (riderId) => riderById.get(riderId)?.name ?? riderId,
  );
  if (names.length === 0) return "Aucun coureur identifié";
  if (names.length <= maximumNames) return formatList(names);
  return `${formatList(names.slice(0, maximumNames))} et ${names.length - maximumNames} autre${names.length - maximumNames > 1 ? "s" : ""}`;
}

function formatList(values: readonly string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} et ${values.at(-1)}`;
}

function formatGap(seconds: number) {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  if (roundedSeconds < 60) return `${roundedSeconds} s`;
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return remainingSeconds === 0
    ? `${minutes} min`
    : `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`;
}

function ensureTerminalPunctuation(value: string) {
  const trimmed = value.trim();
  return /[.!?…]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

function polishCommentary(value: string) {
  const trimmed = value.trim();
  const recollentIndex = trimmed.indexOf(" recollent ");
  const subject =
    recollentIndex >= 0 ? trimmed.slice(0, recollentIndex) : "";
  const agreementCorrected =
    recollentIndex >= 0 && !/[,]|\bet\b/iu.test(subject)
      ? `${subject} recolle ${trimmed.slice(recollentIndex + " recollent ".length)}`
      : trimmed;
  return ensureTerminalPunctuation(agreementCorrected);
}

function selectEvenly<T>(values: readonly T[], maximumCount: number) {
  if (values.length <= maximumCount) return [...values];
  if (maximumCount <= 1) return [values.at(-1)!];
  const selectedIndexes = new Set<number>();
  for (let index = 0; index < maximumCount; index += 1) {
    selectedIndexes.add(
      Math.round((index * (values.length - 1)) / (maximumCount - 1)),
    );
  }
  return [...selectedIndexes].map((index) => values[index]);
}

function deduplicateCandidates(candidates: readonly JournalCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.kind}:${candidate.detail
      .toLocaleLowerCase("fr-FR")
      .replace(/\s+/gu, " ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
