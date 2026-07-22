import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "./race-calendar";
import { getEstimatedLiveDurationMinutes } from "./race-live";
import {
  getStageAttackParticipants,
  type RiderSimulationInput,
  type StageSimulationResult,
} from "./race-simulation";

export type PostRaceNewsEventKind =
  | "breakaway"
  | "incident"
  | "classification";

export type PostRaceNewsEvent = {
  id: string;
  raceEditionId: string;
  stageId: string;
  eventKind: PostRaceNewsEventKind;
  title: string;
  detail: string;
  featuredRiderId: string | null;
  featuredTeamId: string | null;
  happenedAt: string;
};

export function buildPostRaceNewsEvents({
  edition,
  stage,
  simulation,
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  simulation: StageSimulationResult;
}): PostRaceNewsEvent[] {
  const riderById = new Map(
    simulation.resolvedRiders.map((rider) => [rider.id, rider])
  );
  const happenedAt = getStageFinishTimestamp(stage);
  const events: PostRaceNewsEvent[] = [];

  const breakawayRiders = getStageAttackParticipants(simulation)
    .filter((participant) => participant.participationType === "breakaway")
    .map((participant) => riderById.get(participant.riderId))
    .filter((rider): rider is RiderSimulationInput => Boolean(rider));

  if (breakawayRiders.length > 0) {
    const winner = simulation.results.find(
      (result) => result.status === "finished" && result.rank === 1
    );
    const breakawayWinner = winner
      ? breakawayRiders.find((rider) => rider.id === winner.riderId)
      : null;
    const featuredRider = breakawayWinner ?? breakawayRiders[0];

    events.push(
      createEvent({
        edition,
        stage,
        eventKind: "breakaway",
        title: breakawayWinner
          ? `${breakawayWinner.name} va au bout de l’échappée`
          : `${formatRiderNames(breakawayRiders)} anime l’échappée`,
        detail: breakawayWinner
          ? `${breakawayWinner.teamName} transforme l’offensive en victoire sur ${stage.name}.`
          : `${breakawayRiders.length} coureur(s) ont pris le large sur ${edition.name}.`,
        featuredRider,
        happenedAt,
      })
    );
  }

  const abandonedRiders = uniqueRiders(
    simulation.timeline.flatMap((snapshot) =>
      snapshot.abandonments
        .map((abandonment) => riderById.get(abandonment.riderId))
        .filter((rider): rider is RiderSimulationInput => Boolean(rider))
    )
  );

  if (abandonedRiders.length > 0) {
    const featuredRider = abandonedRiders[0];
    events.push(
      createEvent({
        edition,
        stage,
        eventKind: "incident",
        title:
          abandonedRiders.length === 1
            ? `${featuredRider.name} abandonne après une chute`
            : `Une chute provoque ${abandonedRiders.length} abandons`,
        detail: `${formatRiderNames(abandonedRiders)} ne termine pas ${stage.name}.`,
        featuredRider,
        happenedAt,
      })
    );
  }

  if (edition.raceFormat === "stage_race") {
    const mountainLeader = getPrimeLeader(simulation, "mountain", riderById);
    const sprintLeader = getPrimeLeader(
      simulation,
      "intermediate_sprint",
      riderById
    );
    const featuredRider = mountainLeader?.rider ?? sprintLeader?.rider ?? null;

    if (featuredRider && (mountainLeader || sprintLeader)) {
      const details = [
        mountainLeader
          ? `${mountainLeader.rider.name} marque ${mountainLeader.points} pt(s) aux GPM`
          : null,
        sprintLeader
          ? `${sprintLeader.rider.name} marque ${sprintLeader.points} pt(s) aux SI`
          : null,
      ].filter((detail): detail is string => Boolean(detail));

      events.push(
        createEvent({
          edition,
          stage,
          eventKind: "classification",
          title: "Les classements annexes prennent forme",
          detail: `${details.join(" · ")} sur ${stage.name}.`,
          featuredRider,
          happenedAt,
        })
      );
    }
  }

  return events;
}

function createEvent({
  edition,
  stage,
  eventKind,
  title,
  detail,
  featuredRider,
  happenedAt,
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  eventKind: PostRaceNewsEventKind;
  title: string;
  detail: string;
  featuredRider: RiderSimulationInput;
  happenedAt: string;
}): PostRaceNewsEvent {
  return {
    id: `post-race:${stage.id}:${eventKind}`,
    raceEditionId: edition.id,
    stageId: stage.id,
    eventKind,
    title,
    detail,
    featuredRiderId: featuredRider.id,
    featuredTeamId: featuredRider.teamId,
    happenedAt,
  };
}

function getPrimeLeader(
  simulation: StageSimulationResult,
  primeType: "mountain" | "intermediate_sprint",
  riderById: Map<string, RiderSimulationInput>
) {
  const pointsByRiderId = new Map<string, number>();
  for (const prime of simulation.primes) {
    if (prime.prime.type !== primeType) continue;
    for (const classified of prime.classification) {
      pointsByRiderId.set(
        classified.riderId,
        (pointsByRiderId.get(classified.riderId) ?? 0) + classified.points
      );
    }
  }

  const leader = [...pointsByRiderId.entries()].sort(
    (first, second) => second[1] - first[1]
  )[0];
  const rider = leader ? riderById.get(leader[0]) : null;
  return rider && leader ? { rider, points: leader[1] } : null;
}

function getStageFinishTimestamp(stage: RaceCalendarStage) {
  const departureTimestamp = stage.departureAt
    ? new Date(stage.departureAt).getTime()
    : Date.now();
  const durationMs = getEstimatedLiveDurationMinutes(stage.distanceKm) * 60_000;
  return new Date(departureTimestamp + durationMs).toISOString();
}

function formatRiderNames(riders: RiderSimulationInput[]) {
  const names = riders.slice(0, 3).map((rider) => rider.name);
  if (riders.length > 3) return `${names.join(", ")} et ${riders.length - 3} autres`;
  if (names.length === 2) return names.join(" et ");
  return names.join(", ");
}

function uniqueRiders(riders: RiderSimulationInput[]) {
  return [...new Map(riders.map((rider) => [rider.id, rider])).values()];
}
