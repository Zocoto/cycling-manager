import {
  getPopularityMaturityCap,
  type FanClubPilotRider,
  type FanClubPopularityHistoryEntry,
  type FanClubSupporterBreakdown,
} from "@/lib/game/fan-club-pilot";

export type FanClubSportingEvent = {
  id: string;
  kind: "race_result" | "stage_result" | "breakaway";
  season: number;
  day: number;
  reason: string;
  rank: number | null;
  prestigeRank: number;
  forCurrentTeam: boolean;
};

export type FanClubRiderPopularityInput = {
  id: string;
  name: string;
  initials: string;
  role: string;
  country: string;
  nationalityMatchesTeam: boolean;
  activeSeason: number;
  activeDay: number;
  careerSeasons: ReadonlyArray<number>;
  clubSeasons: ReadonlyArray<number>;
  events: ReadonlyArray<FanClubSportingEvent>;
};

export type FanClubAudience = {
  supporterCount: number;
  supporterTrend: number;
  fervor: number;
  popularityIndex: number;
  recentResultsMultiplier: number;
  breakdown: FanClubSupporterBreakdown;
};

type PopularityFactors = {
  recentResults: number;
  majorResults: number;
  panache: number;
  loyalty: number;
  nationality: number;
  momentum: number;
};

export function calculateFanClubRiderPopularity(
  input: FanClubRiderPopularityInput,
): FanClubPilotRider {
  const events = [...input.events].sort(compareEvents);
  const careerSeasons = uniqueSorted(input.careerSeasons);
  const clubSeasons = uniqueSorted(input.clubSeasons);
  const factors = calculateFactors({
    ...input,
    events,
    careerSeasons,
    clubSeasons,
    snapshotSeason: input.activeSeason,
    snapshotDay: input.activeDay,
  });
  const phenomenalSeason = isPhenomenalSeason(events, input.activeSeason);
  const careerSeasonCount = countThrough(careerSeasons, input.activeSeason);
  const popularity = Math.min(
    sumFactors(factors),
    getPopularityMaturityCap(careerSeasonCount, phenomenalSeason),
  );
  const history = buildPopularityHistory({
    ...input,
    events,
    careerSeasons,
    clubSeasons,
  });
  const latestMovement = history[0] ?? null;

  return {
    id: input.id,
    name: input.name,
    initials: input.initials,
    role: input.role,
    country: input.country,
    careerSeasons: Math.max(1, careerSeasonCount),
    seasonsAtClub: Math.max(1, countThrough(clubSeasons, input.activeSeason)),
    popularity,
    trend: latestMovement?.delta ?? 0,
    status: getPopularityStatus(popularity),
    currentDriver:
      latestMovement?.reason ?? "Aucun résultat notable enregistré pour le moment",
    phenomenalSeason,
    factors: [
      { label: "Résultats récents", value: factors.recentResults, maximum: 25 },
      { label: "Palmarès majeur", value: factors.majorResults, maximum: 20 },
      { label: "Panache et échappées", value: factors.panache, maximum: 15 },
      { label: "Fidélité au club", value: factors.loyalty, maximum: 25 },
      { label: "Affinité nationale", value: factors.nationality, maximum: 10 },
      { label: "Dynamique actuelle", value: factors.momentum, maximum: 5 },
    ],
    departureImpact: "Impact calculé après consolidation de l’audience de l’équipe.",
    history,
  };
}

export function calculateFanClubAudience({
  riders,
  directorReputation,
  headquartersLevel,
  activeSeason,
  events,
}: {
  riders: ReadonlyArray<FanClubPilotRider>;
  directorReputation: number;
  headquartersLevel: number;
  activeSeason: number;
  events: ReadonlyArray<FanClubSportingEvent>;
}): FanClubAudience {
  const popularities = riders.map((rider) => rider.popularity);
  const rosterAverage = average(popularities);
  const leadingAverage = average(
    [...popularities].sort((left, right) => right - left).slice(0, 5),
  );
  const popularityIndex = clamp(
    Math.round(rosterAverage * 0.35 + leadingAverage * 0.65),
    0,
    100,
  );
  const currentTeamResultValue = events
    .filter(
      (event) =>
        event.forCurrentTeam &&
        event.season === activeSeason &&
        event.kind !== "breakaway",
    )
    .reduce((total, event) => total + recentResultValue(event), 0);
  const foundation = 250;
  const reputation = Math.round(Math.max(0, directorReputation) * 40);
  const riderAudience = Math.round(
    riders.reduce(
      (total, rider) =>
        total + Math.pow(Math.max(0, rider.popularity), 1.35) * 3,
      0,
    ),
  );
  const recentResults = Math.round(Math.min(40, currentTeamResultValue) * 45);
  const beforeHeadquarters =
    foundation + reputation + riderAudience + recentResults;
  const headquartersBonus = Math.round(
    beforeHeadquarters * Math.max(0, headquartersLevel - 1) * 0.1,
  );
  const supporterCount = Math.max(
    foundation,
    beforeHeadquarters + headquartersBonus,
  );
  const supporterTrend = Math.round(recentResults + headquartersBonus);
  const fervor = clamp(
    Math.round(
      20 +
        popularityIndex * 0.52 +
        Math.min(24, currentTeamResultValue) +
        Math.max(1, headquartersLevel) * 2,
    ),
    0,
    100,
  );

  return {
    supporterCount,
    supporterTrend,
    fervor,
    popularityIndex,
    recentResultsMultiplier: clamp(
      0.85 + currentTeamResultValue / 80,
      0.85,
      1.35,
    ),
    breakdown: {
      foundation,
      reputation,
      riders: riderAudience,
      recentResults,
      headquartersBonus,
    },
  };
}

export function addRiderDepartureImpact(
  rider: FanClubPilotRider,
  supporterCount: number,
  totalPopularity: number,
): FanClubPilotRider {
  const share =
    totalPopularity > 0 ? rider.popularity / totalPopularity : 0;
  const atRisk = Math.round(supporterCount * share * 0.35);
  const fervorLoss = Math.max(1, Math.round(rider.popularity / 14));

  return {
    ...rider,
    departureImpact: `Environ ${atRisk.toLocaleString("fr-FR")} supporters à risque et −${fervorLoss} point${fervorLoss > 1 ? "s" : ""} de ferveur.`,
  };
}

function buildPopularityHistory(
  input: FanClubRiderPopularityInput & {
    events: FanClubSportingEvent[];
    careerSeasons: number[];
    clubSeasons: number[];
  },
): FanClubPopularityHistoryEntry[] {
  const firstSeason = Math.min(
    input.activeSeason,
    input.careerSeasons[0] ?? input.activeSeason,
    input.events[0]?.season ?? input.activeSeason,
  );
  const history: FanClubPopularityHistoryEntry[] = [];
  let previousScore = 0;

  for (let season = firstSeason; season <= input.activeSeason; season += 1) {
    const seasonStartScore = calculateSnapshotScore(input, season, 1, null);
    const startDelta = seasonStartScore - previousScore;
    if (startDelta !== 0 || history.length === 0) {
      history.push({
        id: `${input.id}:season:${season}`,
        season,
        day: 1,
        delta: startDelta,
        scoreAfter: seasonStartScore,
        reason:
          startDelta < 0
            ? "Les résultats de la saison précédente quittent la période récente"
            : input.clubSeasons.includes(season)
              ? "Nouvelle saison de fidélité avec l’équipe"
              : "Nouvelle saison dans la carrière du coureur",
        category: startDelta < 0 ? "decay" : "loyalty",
      });
    }
    previousScore = seasonStartScore;

    const seasonEvents = input.events.filter(
      (event) => event.season === season,
    );
    for (const event of seasonEvents) {
      if (season === input.activeSeason && event.day > input.activeDay) continue;
      const scoreAfter = calculateSnapshotScore(
        input,
        season,
        event.day,
        event.id,
      );
      const delta = scoreAfter - previousScore;
      history.push({
        id: event.id,
        season,
        day: event.day,
        delta,
        scoreAfter,
        reason: event.reason,
        category: event.kind === "breakaway" ? "panache" : "result",
      });
      previousScore = scoreAfter;
    }
  }

  const currentScore = calculateSnapshotScore(
    input,
    input.activeSeason,
    input.activeDay,
  );
  if (currentScore !== previousScore) {
    history.push({
      id: `${input.id}:momentum:${input.activeSeason}:${input.activeDay}`,
      season: input.activeSeason,
      day: input.activeDay,
      delta: currentScore - previousScore,
      scoreAfter: currentScore,
      reason: "La dynamique des derniers jours s’atténue avec le temps",
      category: currentScore < previousScore ? "decay" : "result",
    });
  }

  return history.reverse().slice(0, 12);
}

function calculateSnapshotScore(
  input: FanClubRiderPopularityInput & {
    events: FanClubSportingEvent[];
    careerSeasons: number[];
    clubSeasons: number[];
  },
  snapshotSeason: number,
  snapshotDay: number,
  throughEventId?: string | null,
): number {
  const visibleEvents = input.events.filter((event) => {
    if (event.season < snapshotSeason) return true;
    if (event.season > snapshotSeason) return false;
    if (event.day < snapshotDay) return true;
    if (event.day > snapshotDay) return false;
    if (throughEventId === null) return false;
    return throughEventId === undefined || event.id <= throughEventId;
  });
  const factors = calculateFactors({
    ...input,
    events: visibleEvents,
    snapshotSeason,
    snapshotDay,
  });
  const careerSeasons = countThrough(input.careerSeasons, snapshotSeason);
  const phenomenalSeason = isPhenomenalSeason(
    visibleEvents,
    snapshotSeason,
  );
  return Math.min(
    sumFactors(factors),
    getPopularityMaturityCap(careerSeasons, phenomenalSeason),
  );
}

function calculateFactors({
  events,
  clubSeasons,
  nationalityMatchesTeam,
  snapshotSeason,
  snapshotDay,
}: FanClubRiderPopularityInput & {
  events: ReadonlyArray<FanClubSportingEvent>;
  careerSeasons: ReadonlyArray<number>;
  clubSeasons: ReadonlyArray<number>;
  snapshotSeason: number;
  snapshotDay: number;
}): PopularityFactors {
  const resultEvents = events.filter((event) => event.kind !== "breakaway");
  const currentResults = resultEvents.filter(
    (event) => event.season === snapshotSeason && event.day <= snapshotDay,
  );
  const currentMomentum = currentResults.filter(
    (event) => snapshotDay - event.day <= 5,
  );

  return {
    recentResults: clamp(
      Math.round(
        currentResults.reduce(
          (total, event) => total + recentResultValue(event),
          0,
        ),
      ),
      0,
      25,
    ),
    majorResults: clamp(
      Math.round(
        resultEvents.reduce(
          (total, event) => total + majorResultValue(event),
          0,
        ),
      ),
      0,
      20,
    ),
    panache: clamp(
      events
        .filter((event) => event.kind === "breakaway")
        .reduce(
          (total, event) => total + (event.prestigeRank <= 2 ? 2 : 1),
          0,
        ),
      0,
      15,
    ),
    loyalty: clamp(countThrough(clubSeasons, snapshotSeason) * 5, 0, 25),
    nationality: nationalityMatchesTeam ? 10 : 5,
    momentum: clamp(
      Math.round(
        currentMomentum.reduce(
          (total, event) => total + recentResultValue(event),
          0,
        ) / 3,
      ),
      0,
      5,
    ),
  };
}

function recentResultValue(event: FanClubSportingEvent): number {
  const rank = event.rank ?? 999;
  const prestigeBonus = clamp(4 - event.prestigeRank, 0, 3);
  if (event.kind === "race_result") {
    if (rank === 1) return 6 + prestigeBonus;
    if (rank <= 3) return 4 + prestigeBonus;
    if (rank <= 10) return 2 + Math.floor(prestigeBonus / 2);
    if (rank <= 20) return 1;
  }
  if (event.kind === "stage_result") {
    if (rank === 1) return 3 + Math.floor(prestigeBonus / 2);
    if (rank <= 3) return 2;
    if (rank <= 10) return 1;
  }
  return 0;
}

function majorResultValue(event: FanClubSportingEvent): number {
  const rank = event.rank ?? 999;
  if (event.kind === "race_result") {
    if (rank === 1) return Math.max(2, 6 - event.prestigeRank);
    if (rank <= 3) return Math.max(1, 4 - event.prestigeRank);
    if (rank <= 10 && event.prestigeRank <= 2) return 1;
  }
  if (event.kind === "stage_result" && rank === 1) {
    return event.prestigeRank <= 2 ? 2 : 1;
  }
  return 0;
}

function isPhenomenalSeason(
  events: ReadonlyArray<FanClubSportingEvent>,
  season: number,
): boolean {
  const seasonResults = events.filter(
    (event) => event.season === season && event.kind !== "breakaway",
  );
  const raceWins = seasonResults.filter(
    (event) => event.kind === "race_result" && event.rank === 1,
  );
  return (
    raceWins.some((event) => event.prestigeRank <= 2) ||
    raceWins.length >= 4 ||
    seasonResults.reduce(
      (total, event) => total + recentResultValue(event),
      0,
    ) >= 30
  );
}

function sumFactors(factors: PopularityFactors): number {
  return Object.values(factors).reduce((total, value) => total + value, 0);
}

function getPopularityStatus(popularity: number): string {
  if (popularity >= 80) return "Icône du peloton";
  if (popularity >= 60) return "Figure du club";
  if (popularity >= 40) return "Très apprécié";
  if (popularity >= 20) return "Reconnu";
  return "À découvrir";
}

function compareEvents(
  left: FanClubSportingEvent,
  right: FanClubSportingEvent,
): number {
  return (
    left.season - right.season ||
    left.day - right.day ||
    left.id.localeCompare(right.id)
  );
}

function uniqueSorted(values: ReadonlyArray<number>): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function countThrough(values: ReadonlyArray<number>, season: number): number {
  return values.filter((value) => value <= season).length;
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

