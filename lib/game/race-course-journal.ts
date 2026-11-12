import type {
  RaceGroupSnapshot,
  RaceIncidentType,
  RaceTimelineSnapshot,
  RiderSimulationInput,
  StageSimulationResult,
} from "./race-simulation";

export const RACE_COURSE_JOURNAL_MAX_ENTRIES = 96;

export type RaceCourseJournalEntryKind =
  | "start"
  | "breakaway"
  | "gap"
  | "junction"
  | "attack"
  | "incident"
  | "prime"
  | "selection"
  | "finish";

export type RaceCourseJournalEntry = {
  id: string;
  kind: RaceCourseJournalEntryKind;
  distanceKm: number;
  title: string;
  detail: string;
  riderIds?: string[];
  caughtRiderIds?: string[];
  segmentNumber?: number;
  distanceIsSegmentEnd?: true;
};

type JournalEvent = Omit<RaceCourseJournalEntry, "id"> & { priority: number };
type JournalCandidate = JournalEvent & { id: string; sequence: number };
type RiderById = ReadonlyMap<string, RiderSimulationInput>;

const JUNCTION = /fusionnent|recoll(?:e|ent)|rejoin(?:t|nent)(?: la tête| le groupe)|réintègre|rattrap(?:e|ent)|vient de les reprendre/iu;
const CAUGHT = /\b(?:est|sont) repris\b|s[’']intègr(?:e|ent) au groupe retardé qui vient de les reprendre|ne (?:peut|peuvent) pas suivre le regroupement/iu;
const GROUP_CAUGHT = /l[’']échappée est reprise/iu;
const PLANNED_ATTACK = /déclench(?:e|ent) l[’']attaque préparée/iu;
const ATTACK = /place une attaque|attaque dans le final|pass(?:e|ent) à l[’']attaque|contre[- ]attaqu|part seul en chasse-patate|tenter de rejoindre la tête|accélération|impose son rythme|prolonge son attaque|offensive décisive/iu;
const SELECTION = /lâche(?:nt)?\b|décroche(?:nt)?\b|ne tient pas|sont distancés|est distancé|cassure|perd(?:ent)? le contact/iu;
const CHASE = /organisent la poursuite|prend(?:nent)? les relais|relancent la poursuite/iu;
const INCIDENT_COMMENTARY = /crevaison|chute|bordure/iu;
const PRIME_COMMENTARY = /passe en tête (?:du GPM|du sprint intermédiaire)/iu;

export function buildRaceCourseJournal({ simulation }: { simulation: StageSimulationResult }): RaceCourseJournalEntry[] {
  const riderById = new Map(simulation.resolvedRiders.map((rider) => [rider.id, rider]));
  const findRiderIds = createRiderMentionFinder(simulation.resolvedRiders);
  const finalSnapshot = simulation.timeline.at(-1);
  const totalDistanceKm = finalSnapshot?.completedDistanceKm ?? 0;
  const candidates: JournalCandidate[] = [];
  const push = (entry: JournalEvent) => {
    const sequence = candidates.length;
    candidates.push({ ...entry, sequence,
      id: `course-journal-${entry.kind}-${Math.round(entry.distanceKm * 10)}-${sequence}` });
  };

  push({ kind: "start", distanceKm: 0, title: "Départ",
    detail: `${simulation.resolvedRiders.length} coureurs prennent le départ.`, priority: 100 });

  // The final groups are aligned with result times, so they are not a new race checkpoint.
  for (const episode of getBreakawayEpisodes(simulation.timeline.slice(0, -1))) {
    const firstSnapshot = episode[0];
    const riderIds = getBreakawayRiderIds(firstSnapshot);
    push({ kind: "breakaway", distanceKm: firstSnapshot.completedDistanceKm, title: "Échappée",
      detail: `Une échappée de ${riderIds.length} coureur${riderIds.length > 1 ? "s" : ""} se forme : ${formatRiderNames(riderIds, riderById, 6)}.`,
      riderIds, priority: 84 });

    const peak = getBreakawayPeakGap(episode);
    if (peak && peak.gapSeconds >= 20) {
      push({ kind: "gap", distanceKm: peak.snapshot.completedDistanceKm, title: "Écart maximal",
        detail: `L’échappée porte son avance à ${formatGap(peak.gapSeconds)}.`,
        riderIds: getBreakawayRiderIds(peak.snapshot), priority: 72 });
    }
  }

  const primesBySegment = new Map<number, StageSimulationResult["primes"][number]>();
  let lastMountainSegment = -1;
  for (const prime of simulation.primes ?? []) {
    primesBySegment.set(prime.segmentNumber, prime);
    if (prime.prime.type === "mountain") lastMountainSegment = Math.max(lastMountainSegment, prime.segmentNumber);
  }

  for (const [index, snapshot] of simulation.timeline.entries()) {
    const previous = simulation.timeline[index - 1];
    const distanceKm = snapshot.completedDistanceKm;
    const segmentNumber = snapshot.segmentNumber;
    const recordedCatches = new Set<string>();
    let recordedBreakawayCatch: string | undefined;

    for (const incident of snapshot.incidents ?? []) {
      const riderNames = formatRiderNames(incident.riderIds, riderById, 5);
      const abandonedNames = formatRiderNames(incident.abandonedRiderIds, riderById, 4);
      const abandonment = incident.abandonedRiderIds.length > 0
        ? ` ${abandonedNames} abandonne${incident.abandonedRiderIds.length > 1 ? "nt" : ""}.` : "";
      push({ kind: "incident", distanceKm, segmentNumber, title: getIncidentTitle(incident.type),
        detail: getIncidentDetail(incident.type, riderNames) + abandonment,
        riderIds: [...new Set([...incident.riderIds, ...incident.abandonedRiderIds])],
        priority: incident.type.startsWith("crash_") || abandonment ? 96 : 88 });
    }

    for (const message of snapshot.commentary ?? []) {
      if (GROUP_CAUGHT.test(message)) {
        recordedBreakawayCatch = polishCommentary(message);
        continue;
      }
      if (PRIME_COMMENTARY.test(message)) {
        if (!primesBySegment.has(segmentNumber)) {
          push({ kind: "prime", distanceKm, segmentNumber, title: "Prime intermédiaire",
            detail: polishCommentary(message), riderIds: findRiderIds(message), priority: 89,
            ...(segmentNumber === finalSnapshot?.segmentNumber ? { distanceIsSegmentEnd: true } : {}) });
        }
        continue;
      }
      const planned = PLANNED_ATTACK.test(message);
      const detail = polishCommentary(message);
      if (CAUGHT.test(message)) {
        const caughtRiderIds = findRiderIds(message.split(CAUGHT, 1)[0]);
        for (const riderId of caughtRiderIds) recordedCatches.add(riderId);
        push({ kind: "junction", distanceKm, segmentNumber, title: "Reprise", detail,
          riderIds: findRiderIds(message), caughtRiderIds, priority: 96 });
      } else if (planned || ATTACK.test(message)) {
        const riderIds = findRiderIds(message);
        if (riderIds.length || planned) {
          push({ kind: "attack", distanceKm: planned ? previous?.completedDistanceKm ?? 0 : distanceKm, segmentNumber,
            title: planned ? "Attaque préparée" : "Offensive", detail, riderIds, priority: 94 });
        }
      } else if (JUNCTION.test(message)) {
        push({ kind: "junction", distanceKm, segmentNumber, title: "Jonction", detail,
          riderIds: findRiderIds(message), priority: 74 });
      } else if (SELECTION.test(message) && !INCIDENT_COMMENTARY.test(message)) {
        const riderIds = findRiderIds(message);
        if (riderIds.length) {
          push({ kind: "selection", distanceKm, segmentNumber, title: "Perte de contact", detail, riderIds, priority: 78 });
        }
      } else if (CHASE.test(message)) {
        push({ kind: "gap", distanceKm, segmentNumber, title: "Poursuite", detail, riderIds: findRiderIds(message), priority: 60 });
      }
    }

    const reprises = previous && snapshot !== finalSnapshot
      ? getReprises(previous, snapshot, recordedCatches, riderById)
      : [];
    for (const reprise of reprises) push(reprise);
    if (recordedBreakawayCatch && !reprises.some((entry) => entry.title === "Échappée reprise")) {
      push({ kind: "junction", distanceKm, segmentNumber, title: "Échappée reprise",
        detail: recordedBreakawayCatch, priority: 86 });
    }

    const prime = primesBySegment.get(segmentNumber);
    const primeWinner = prime?.classification.find((rider) => rider.rank === 1);
    if (prime && primeWinner && previous?.segmentNumber !== segmentNumber) {
      const mountain = prime.prime.type === "mountain";
      const lastMountain = mountain && segmentNumber === lastMountainSegment;
      const onFinishSegment = segmentNumber === finalSnapshot?.segmentNumber;
      const riderName = riderById.get(primeWinner.riderId)?.name ?? primeWinner.riderId;
      const points = `${primeWinner.points} point${primeWinner.points === 1 ? "" : "s"}`;
      const category = mountain && prime.prime.category ? ` (catégorie ${prime.prime.category})` : "";
      const location = onFinishSegment ? " sur le dernier tronçon" : "";
      const prize = mountain ? "le prix du GPM" : "le sprint intermédiaire";
      push({ kind: "prime", distanceKm, segmentNumber,
        title: lastMountain ? "Dernier GPM" : mountain ? "Passage au GPM" : "Sprint intermédiaire",
        detail: `${riderName} remporte ${prize}${category}${location} et marque ${points}.`,
        riderIds: [primeWinner.riderId], priority: lastMountain ? 99 : 89,
        ...(onFinishSegment ? { distanceIsSegmentEnd: true } : {}) });
    }
  }

  if (finalSnapshot && (finalSnapshot.groups ?? []).length > 1 && finalSnapshot.groups[0].type !== "time_trial") {
    const leadingGroup = finalSnapshot.groups[0];
    const size = leadingGroup.riderIds.length;
    push({ kind: "selection", distanceKm: totalDistanceKm, title: "Sélection à l’arrivée",
      detail: size <= 1
        ? "Le vainqueur franchit la ligne seul."
        : `Un groupe de tête de ${size} coureurs se présente pour la victoire.`,
      riderIds: leadingGroup.riderIds, priority: 79 });
  }

  const winner = simulation.results.find((result) => result.status === "finished" && result.rank === 1);
  const runnerUp = simulation.results.find((result) => result.status === "finished" && result.rank === 2);
  if (winner) {
    push({ kind: "finish", distanceKm: totalDistanceKm, title: "Victoire",
      detail: formatVictory(winner, runnerUp, riderById),
      riderIds: runnerUp ? [winner.riderId, runnerUp.riderId] : [winner.riderId], priority: 110 });
  }

  const seen = new Set<string>();
  const unique = candidates.filter((entry) => {
    const position = entry.riderIds?.length || entry.kind !== "gap" ? entry.distanceKm : "";
    const key = `${entry.kind}:${position}:${entry.detail.toLocaleLowerCase("fr-FR").replace(/\s+/gu, " ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const retained = unique.length <= RACE_COURSE_JOURNAL_MAX_ENTRIES ? unique : unique
    .sort((a, b) => b.priority - a.priority || a.sequence - b.sequence)
    .slice(0, RACE_COURSE_JOURNAL_MAX_ENTRIES);
  return retained.sort((a, b) => a.distanceKm - b.distanceKm || a.sequence - b.sequence)
    .map(({ id, kind, distanceKm, title, detail, riderIds, caughtRiderIds, segmentNumber, distanceIsSegmentEnd }) => ({
      id, kind, distanceKm, title, detail, riderIds, caughtRiderIds, segmentNumber, distanceIsSegmentEnd,
    }));
}

function getBreakawayRiderIds(snapshot: RaceTimelineSnapshot) {
  return [...new Set((snapshot.groups ?? []).filter((group) => group.type === "breakaway").flatMap((group) => group.riderIds))];
}

function getBreakawayEpisodes(timeline: readonly RaceTimelineSnapshot[]) {
  const episodes: RaceTimelineSnapshot[][] = [];
  let active: RaceTimelineSnapshot[] = [];
  let previousRiderIds = new Set<string>();
  for (const snapshot of timeline) {
    const riderIds = getBreakawayRiderIds(snapshot);
    const shared = riderIds.filter((id) => previousRiderIds.has(id)).length;
    const sameEpisode = shared >= Math.max(1, Math.min(riderIds.length, previousRiderIds.size) * 0.35);
    if (!sameEpisode && active.length) {
      episodes.push(active);
      active = [];
    }
    if (riderIds.length) active.push(snapshot);
    previousRiderIds = new Set(riderIds);
  }
  if (active.length) episodes.push(active);
  return episodes;
}

function getBreakawayPeakGap(snapshots: readonly RaceTimelineSnapshot[]) {
  let peak: { snapshot: RaceTimelineSnapshot; gapSeconds: number } | null = null;
  for (const snapshot of snapshots) {
    const groups = snapshot.groups ?? [];
    const breakawayGap = Math.min(...groups.filter((g) => g.type === "breakaway").map((g) => g.gapToLeaderSeconds));
    const pelotonGap = Math.min(...groups.filter((g) => g.type === "peloton").map((g) => g.gapToLeaderSeconds));
    if (!Number.isFinite(breakawayGap) || !Number.isFinite(pelotonGap)) continue;
    const gapSeconds = Math.max(0, pelotonGap - breakawayGap);
    if (!peak || gapSeconds > peak.gapSeconds) peak = { snapshot, gapSeconds };
  }
  return peak;
}

function getGroupByRider(groups: readonly RaceGroupSnapshot[]) {
  return new Map(groups.flatMap((group) => group.riderIds.map((id) => [id, group] as const)));
}

/** A change of group label alone cannot establish a catch. A previously trailing
 * group must actually share the rider's group or be ahead at the next checkpoint. */
function getReprises(previous: RaceTimelineSnapshot, current: RaceTimelineSnapshot,
  recordedCatches: ReadonlySet<string>, riderById: RiderById): JournalEvent[] {
  const previousGroups = previous.groups ?? [];
  const currentGroups = current.groups ?? [];
  const previousPeloton = previousGroups.find((group) => group.type === "peloton");
  const currentPeloton = currentGroups.find((group) => group.type === "peloton");
  const priorGroupsByRider = getGroupByRider(previousGroups);
  const currentGroupsByRider = getGroupByRider(currentGroups);
  const samePeloton = previousPeloton && currentPeloton?.riderIds.some((id) => priorGroupsByRider.get(id) === previousPeloton);
  const reports: JournalEvent[] = [];

  for (const detached of previousGroups) {
    if (detached.type !== "breakaway" && detached.type !== "chase") continue;
    const byPeloton: string[] = [];
    const byPursuers: string[] = [];
    const passedByPeloton: string[] = [];
    const wasAheadOfPeloton = previousPeloton && previousPeloton.gapToLeaderSeconds > detached.gapToLeaderSeconds;
    for (const riderId of detached.riderIds) {
      const group = currentGroupsByRider.get(riderId);
      if (!group || recordedCatches.has(riderId) || !riderById.has(riderId)) continue;
      if (wasAheadOfPeloton && samePeloton && group === currentPeloton) {
        byPeloton.push(riderId);
      } else if (wasAheadOfPeloton && samePeloton && currentPeloton && group.gapToLeaderSeconds > currentPeloton.gapToLeaderSeconds) {
        passedByPeloton.push(riderId);
      } else if (group.riderIds.some((id) => {
        const former = priorGroupsByRider.get(id);
        return former && former.type !== "dropped" && former.gapToLeaderSeconds > detached.gapToLeaderSeconds;
      })) {
        byPursuers.push(riderId);
      }
    }
    const add = (title: string, ids: string[], detail: (names: string, plural: boolean) => string) => {
      if (!ids.length) return;
      reports.push({ kind: "junction", distanceKm: current.completedDistanceKm, segmentNumber: current.segmentNumber,
        title, detail: detail(formatRiderNames(ids, riderById, 6), ids.length > 1), riderIds: ids, caughtRiderIds: ids, priority: 94 });
    };
    add(detached.type === "breakaway" ? "Échappée reprise" : "Reprise par le peloton", byPeloton,
      (names, plural) => `${names} ${plural ? "sont repris" : "est repris"} par le peloton au pointage du tronçon.`);
    add("Jonction des poursuivants", byPursuers,
      (names, plural) => `${names} ${plural ? "sont rejoints" : "est rejoint"} par leurs poursuivants au pointage du tronçon.`);
    add("Dépassé par le peloton", passedByPeloton,
      (names, plural) => `Au pointage du tronçon, le peloton est passé devant ${names}, qui ${plural ? "restent distancés" : "reste distancé"}.`);
  }
  return reports;
}

function createRiderMentionFinder(riders: readonly RiderSimulationInput[]): (message: string) => string[] {
  const idsByName = new Map<string, string | null>();
  for (const rider of riders) {
    const name = rider.name.trim().normalize("NFC");
    if (name) idsByName.set(name, idsByName.has(name) ? null : rider.id);
  }
  const names = [...idsByName.keys()].sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  if (names.length === 0) return () => [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`, "gu");
  return (message: string) => [...new Set([...message.normalize("NFC").matchAll(pattern)]
    .map(([name]) => idsByName.get(name)).filter((id): id is string => Boolean(id)))];
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

type RiderResult = StageSimulationResult["results"][number];

function formatVictory(winner: RiderResult, runnerUp: RiderResult | undefined, riderById: RiderById) {
  const winnerRider = riderById.get(winner.riderId);
  const winnerName = winnerRider?.name ?? winner.riderId;
  const teamSuffix = winnerRider?.teamName ? ` (${winnerRider.teamName})` : "";
  if (!runnerUp) return `${winnerName}${teamSuffix} remporte la course.`;
  const runnerUpName = riderById.get(runnerUp.riderId)?.name ?? runnerUp.riderId;
  const gapSeconds = Math.max(0, runnerUp.gapToWinnerSeconds);
  return gapSeconds >= 1
    ? `${winnerName}${teamSuffix} s’impose avec ${formatGap(gapSeconds)} d’avance sur ${runnerUpName}.`
    : `${winnerName}${teamSuffix} devance ${runnerUpName} sur la ligne et remporte la course.`;
}

function formatRiderNames(riderIds: readonly string[], riderById: RiderById, maximumNames: number) {
  const names = [...new Set(riderIds)].map((id) => riderById.get(id)?.name ?? id);
  if (names.length === 0) return "Aucun coureur identifié";
  if (names.length <= maximumNames) return formatList(names);
  const remaining = names.length - maximumNames;
  return `${formatList(names.slice(0, maximumNames))} et ${remaining} autre${remaining > 1 ? "s" : ""}`;
}

function formatList(values: readonly string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} et ${values.at(-1)}`;
}

function formatGap(seconds: number) {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  if (roundedSeconds < 60) return `${roundedSeconds} s`;
  const minutes = Math.floor(roundedSeconds / 60);
  const remaining = roundedSeconds % 60;
  return remaining === 0 ? `${minutes} min` : `${minutes} min ${remaining.toString().padStart(2, "0")} s`;
}

function polishCommentary(value: string) {
  const trimmed = value.trim();
  const recollentIndex = trimmed.indexOf(" recollent ");
  const subject = recollentIndex >= 0 ? trimmed.slice(0, recollentIndex) : "";
  const corrected = recollentIndex >= 0 && !/[,]|\bet\b/iu.test(subject)
    ? `${subject} recolle ${trimmed.slice(recollentIndex + " recollent ".length)}` : trimmed;
  return /[.!?…]$/u.test(corrected) ? corrected : `${corrected}.`;
}
