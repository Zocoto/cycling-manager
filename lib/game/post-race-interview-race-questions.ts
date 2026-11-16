import type {
  PostRaceInterviewContext,
  PostRaceInterviewQuestion,
} from "./post-race-interview";
import type { RaceCourseJournalEntry } from "./race-course-journal";
import {
  buildTeamTimeTrialStageClassification,
  type OfficialCombativityAward,
  type OfficialRiderResult,
} from "./race-results";
import type { RaceIncidentType, StageSimulationResult } from "./race-simulation";
import type { RaceTeamWorkKind } from "./race-team-work";

type Rider = { name: string; rank: number };
type Opponent = Rider & { team: string };
type RacePoint = { name: string; km: number };
type RiderRacePoint = RacePoint & { riderId: string };
type ScoredPrime = RacePoint & { type: StageSimulationResult["primes"][number]["prime"]["type"]; rank: number; points: number };

export type PostRaceInterviewDetailedRaceFacts = {
  finishers: number;
  starters: number;
  best?: Rider;
  second?: Rider;
  winner?: Opponent;
  ahead?: Opponent;
  winnerGapMs?: number;
  teamTimeTrial?: { rank: number; timeMs: number; gapMs: number; winnerTeam: string };
  individualTimeTrial?: { ownTimeMs: number; gapAheadMs?: number };
  finishMode?: StageSimulationResult["roadFinishMode"];
  breakaway?: RacePoint;
  pursuit?: RiderRacePoint;
  caught?: RacePoint;
  attack?: RacePoint & { planned: boolean };
  lostContact?: RiderRacePoint;
  incidents: (RiderRacePoint & { type: RaceIncidentType; abandoned: boolean; finished: boolean })[];
  primes: ScoredPrime[];
  work: { kind: RaceTeamWorkKind; name: string; target?: string; km: number }[];
  combativity?: { name: string; breakawayKm?: number };
  abandoned?: string;
};

type Ranked = OfficialRiderResult & { rank: number };

function isRanked(result: OfficialRiderResult): result is Ranked {
  return result.status === "finished" && result.rank !== null && Number.isInteger(result.rank) && result.rank > 0;
}

function validKm(km: number) {
  return Number.isFinite(km) && km >= 0;
}

function isOwnRider(result: OfficialRiderResult, teamId: string) {
  return result.teamId === teamId || result.teamProfileId === teamId;
}

function asRider(result: Ranked): Rider {
  return { name: result.riderName, rank: result.rank };
}

export function extractDetailedRaceInterviewFacts({
  teamId,
  stageId,
  stageType = "road",
  stageResults,
  simulation,
  courseJournal,
  combativityAwards,
}: {
  teamId: string;
  stageId: string;
  stageType?: PostRaceInterviewContext["stageType"];
  stageResults: readonly OfficialRiderResult[];
  simulation?: StageSimulationResult | null;
  courseJournal?: readonly RaceCourseJournalEntry[];
  combativityAwards?: readonly OfficialCombativityAward[];
}): PostRaceInterviewDetailedRaceFacts | undefined {
  const own = stageResults.filter((result) => isOwnRider(result, teamId));
  if (!own.length) return undefined;

  const ranked = stageResults.filter(isRanked).sort((a, b) => a.rank - b.rank);
  const best = ranked.find((result) => isOwnRider(result, teamId));
  const nextBest = ranked.find((result) => result.riderId !== best?.riderId && isOwnRider(result, teamId));
  const winner = ranked.find((result) => result.rank === 1 && !isOwnRider(result, teamId));
  const ahead = best && ranked.find((result) => result.rank === best.rank - 1 && !isOwnRider(result, teamId));
  const starters = own.filter((result) => result.status !== "did_not_start" && result.status !== "withdrawn");
  const byId = new Map(starters.map((result) => [result.riderId, result]));
  const isTeamTrial = stageType === "team_time_trial";
  const isIndividualTrial = stageType === "individual_time_trial" || stageType === "prologue";
  const abandon = own.find((result) => result.status === "did_not_finish");
  const facts: PostRaceInterviewDetailedRaceFacts = {
    starters: starters.length,
    finishers: own.filter(isRanked).length,
    incidents: [],
    primes: [],
    work: [],
    ...(abandon ? { abandoned: abandon.riderName } : {}),
  };
  if (isTeamTrial) {
    const teams = buildTeamTimeTrialStageClassification(stageResults);
    const ownTeam = teams.find((team) => team.teamId === teamId || team.teamProfileId === teamId);
    if (ownTeam && teams[0]) {
      facts.teamTimeTrial = {
        rank: ownTeam.rank, timeMs: ownTeam.totalTimeMs,
        gapMs: ownTeam.totalTimeMs - teams[0].totalTimeMs, winnerTeam: teams[0].teamName,
      };
    }
  } else {
    if (best) facts.best = asRider(best);
    if (nextBest) facts.second = asRider(nextBest);
    if (winner) facts.winner = { ...asRider(winner), team: winner.teamName };
    if (ahead) facts.ahead = { ...asRider(ahead), team: ahead.teamName };
    if (best?.gapToWinnerMs != null && best.gapToWinnerMs >= 0) facts.winnerGapMs = best.gapToWinnerMs;
  }
  if (isIndividualTrial && best?.elapsedTimeMs != null && best.elapsedTimeMs > 0) {
    const gapAheadMs = ahead?.elapsedTimeMs != null ? best.elapsedTimeMs - ahead.elapsedTimeMs : null;
    facts.individualTimeTrial = {
      ownTimeMs: best.elapsedTimeMs,
      ...(gapAheadMs != null && gapAheadMs >= 0 ? { gapAheadMs } : {}),
    };
  }

  const award = combativityAwards?.find((award) => award.scope === "stage"
    && award.stageId === stageId && byId.has(award.riderId));
  if (award && stageType === "road") {
    facts.combativity = {
      name: award.riderName,
      ...(award.distanceAtFrontKm >= 1 ? { breakawayKm: award.distanceAtFrontKm } : {}),
    };
  }

  if (simulation?.stageId !== stageId) return facts;
  const road = stageType === "road";
  if (road && simulation.roadFinishMode) facts.finishMode = simulation.roadFinishMode;

  // The last snapshot reconciles groups with finish times. It does not record
  // a new observation of a rider getting clear or losing contact.
  const checkpoints = simulation.timeline.slice(0, -1);
  const starts = new Map<string, RiderRacePoint>();
  for (const frame of checkpoints) {
    if (!validKm(frame.completedDistanceKm)) continue;
    for (const group of frame.groups) {
      if (!road || (group.type !== "breakaway" && group.type !== "chase")) continue;
      const id = group.riderIds.find((riderId) => byId.has(riderId));
      if (!id) continue;
      const point = { riderId: id, name: byId.get(id)!.riderName, km: frame.completedDistanceKm };
      const key = group.type === "breakaway" ? "breakaway" : "pursuit";
      if (!starts.has(key)) starts.set(key, point);
    }
  }
  facts.breakaway = starts.get("breakaway");
  facts.pursuit = starts.get("pursuit");

  const seenIncidents = new Set<RaceIncidentType>();
  for (const frame of simulation.timeline) {
    if (!validKm(frame.completedDistanceKm)) continue;
    for (const incident of frame.incidents ?? []) {
      if (seenIncidents.has(incident.type)) continue;
      const ownAbandonment = incident.abandonedRiderIds.find((id) => byId.get(id)?.status === "did_not_finish");
      const id = ownAbandonment ?? incident.riderIds.find((id) => byId.has(id));
      if (!id) continue;
      const result = byId.get(id)!;
      facts.incidents.push({
        riderId: id, name: result.riderName, km: frame.completedDistanceKm, type: incident.type,
        abandoned: Boolean(ownAbandonment), finished: result.status === "finished",
      });
      seenIncidents.add(incident.type);
    }
  }

  if (road) {
    for (const entry of courseJournal ?? []) {
      if (!validKm(entry.distanceKm)) continue;
      if (entry.kind === "junction" && !facts.caught) {
        const id = entry.caughtRiderIds?.find((riderId) => byId.has(riderId));
        if (id) facts.caught = { name: byId.get(id)!.riderName, km: entry.distanceKm };
      }
      if (entry.kind === "attack" && entry.riderIds?.length === 1) {
        const rider = byId.get(entry.riderIds[0]!);
        const planned = entry.title === "Attaque préparée";
        if (rider && (!facts.attack || (planned && !facts.attack.planned))) {
          facts.attack = { name: rider.riderName, km: entry.distanceKm, planned };
        }
      }
      if (entry.kind === "selection" && entry.title === "Perte de contact"
        && !facts.lostContact && entry.riderIds?.length === 1) {
        const rider = byId.get(entry.riderIds[0]!);
        if (rider) facts.lostContact = { riderId: rider.riderId, name: rider.riderName, km: entry.distanceKm };
      }
    }
    const kmBySegment = new Map(simulation.timeline.map((frame) => [frame.segmentNumber, frame.completedDistanceKm]));
    for (const prime of simulation.primes ?? []) {
      const km = kmBySegment.get(prime.segmentNumber);
      if (km === undefined || !validKm(km)) continue;
      for (const scorer of prime.classification) {
        const rider = byId.get(scorer.riderId);
        if (!rider || scorer.points <= 0) continue;
        const sameType = facts.primes.findIndex((entry) => entry.type === prime.prime.type);
        if (sameType >= 0 && facts.primes[sameType]!.rank <= scorer.rank) continue;
        const fact = { name: rider.riderName, km, type: prime.prime.type, rank: scorer.rank, points: scorer.points };
        if (sameType < 0) facts.primes.push(fact);
        else facts.primes[sameType] = fact;
      }
    }
    for (const period of simulation.teamWork ?? []) {
      const rider = byId.get(period.riderId);
      const distance = period.endKm - period.startKm;
      if (!rider || !Number.isFinite(distance) || distance < 0.5) continue;
      const targetId = period.targetRiderIds.find((id) => id !== period.riderId && byId.has(id));
      const ending = facts.work.findIndex((entry) => entry.kind === period.kind);
      if (ending >= 0 && facts.work[ending]!.km >= distance) continue;
      const work = {
        kind: period.kind, name: rider.riderName,
        ...(targetId ? { target: byId.get(targetId)!.riderName } : {}),
        km: distance,
      };
      if (ending < 0) facts.work.push(work);
      else facts.work[ending] = work;
    }
  }
  return facts;
}

function frenchRank(rank: number) {
  return rank === 1 ? "1er" : `${rank}e`;
}

function englishRank(rank: number) {
  const lastTwo = rank % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th");
  return `${rank}${suffix}`;
}

function duration(milliseconds: number, language: "fr" | "en") {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remaining = ((milliseconds % 60_000) / 1_000).toLocaleString(language, { maximumFractionDigits: 3 });
  return [hours ? `${hours} h` : "", hours || minutes ? `${minutes} min` : "", `${remaining} s`]
    .filter(Boolean)
    .join(" ");
}

function position(km: number, language: "fr" | "en") {
  return km === 0 ? (language === "fr" ? "au départ" : "at the start")
    : language === "fr"
      ? `au km ${km.toLocaleString("fr", { maximumFractionDigits: 1 })}`
      : `at km ${km.toLocaleString("en", { maximumFractionDigits: 1 })}`;
}

type QuestionPair = readonly [french: string, english: string];
type AddQuestions = (
  family: string,
  category: "result" | "race_fact" | "tactics",
  variants: readonly QuestionPair[],
) => void;

export const TEAM_TIME_TRIAL_INTERVIEW_FALLBACK: readonly PostRaceInterviewQuestion[] = [
  {
    id: "race-detail-team-time-summary",
    topic: "ttt",
    category: "result",
    text: "Quel bilan tirez-vous de ce chrono collectif et du travail de votre équipe ?",
    textEn: "How do you sum up this team time trial and the way your riders worked together?",
  },
  {
    id: "race-detail-team-time-strategy",
    topic: "ttt-strategy",
    category: "tactics",
    text: "Comment avez-vous choisi l’allure des relais pour garder vos coureurs ensemble ?",
    textEn: "How did you set the pace of the turns to keep your riders together?",
  },
];

function addFinishQuestions(facts: PostRaceInterviewDetailedRaceFacts, add: AddQuestions) {
  const { best, second, winner, winnerGapMs, finishers, starters } = facts;
  if (facts.teamTimeTrial) {
    const { rank, timeMs, gapMs, winnerTeam } = facts.teamTimeTrial;
    add("team-time", "result", [
      [`Votre équipe signe le ${frenchRank(rank)} temps en ${duration(timeMs, "fr")}. Êtes-vous satisfait de la façon dont vos coureurs se sont relayés ?`,
        `Your squad finished ${englishRank(rank)} in ${duration(timeMs, "en")}. Were you happy with how your riders took turns?`],
      [`Vous prenez la ${rank === 1 ? "première" : `${rank}e`} place au chrono par équipes. Où avez-vous gagné ou perdu le plus de temps ?`,
        `You finished ${englishRank(rank)} in the team time trial. Where did you gain or lose the most time?`],
    ]);
    if (gapMs > 0) add("team-gap", "tactics", [
      [`${winnerTeam} vous devance de ${duration(gapMs, "fr")}. Que changeriez-vous dans vos relais au prochain chrono par équipes ?`,
        `${winnerTeam} beat you by ${duration(gapMs, "en")}. What would you change about your turns in the next team time trial?`],
      [`Il vous manque ${duration(gapMs, "fr")} sur ${winnerTeam}. Sur un autre parcours, garderiez-vous la même composition ?`,
        `You were ${duration(gapMs, "en")} behind ${winnerTeam}. Would you pick the same line-up on a different course?`],
    ]);
  }
  if (best) {
    add("best-place", "result", [
      [`${best.name} est le mieux classé de votre équipe, à la ${best.rank === 1 ? "première" : `${best.rank}e`} place. Qu’est-ce qui a le plus compté dans sa performance ?`,
        `${best.name} was your best finisher in ${englishRank(best.rank)}. What made the biggest difference to his performance?`],
      [`${best.name} finit ${frenchRank(best.rank)}. Quel a été le moment décisif de sa course ?`,
        `${best.name} finished ${englishRank(best.rank)}. What was the turning point in his race?`],
      [`${best.name} termine ${frenchRank(best.rank)}. Au-delà du classement, que retenez-vous de sa course ?`,
        `${best.name} finished ${englishRank(best.rank)}. Beyond the result, what stood out about his race?`],
    ]);
  }
  if (best && second && second.rank <= 15) add("two-finishers", "result", [
    [`${best.name} termine ${frenchRank(best.rank)} et ${second.name} ${frenchRank(second.rank)}. Est-ce le résultat que vous attendiez de ces deux coureurs ?`,
      `${best.name} finished ${englishRank(best.rank)} and ${second.name} ${englishRank(second.rank)}. Was this the result you expected from them?`],
    [`${best.name} et ${second.name} terminent dans les quinze premiers. Les aligneriez-vous de nouveau sur un parcours similaire ?`,
      `${best.name} and ${second.name} both finished in the top fifteen. Would you select them both for a similar course?`],
  ]);
  if (best && winner && winnerGapMs != null && winnerGapMs > 0) add("winner-margin", "result", [
    [`${best.name} termine à ${duration(winnerGapMs, "fr")} de ${winner.name}. À quel endroit du parcours pensez-vous qu’il aurait pu gagner du temps ?`,
      `${best.name} finished ${duration(winnerGapMs, "en")} behind ${winner.name}. Where on the course do you think he could have gained time?`],
    [`${winner.name}, chez ${winner.team}, devance ${best.name} de ${duration(winnerGapMs, "fr")}. Qu’est-ce que vous retenez de la prestation de cette équipe ?`,
      `${winner.name} of ${winner.team} beat ${best.name} by ${duration(winnerGapMs, "en")}. What did you take away from that team's performance?`],
  ]);
  if (best && winner && winnerGapMs === 0) add("same-finish-time", "result", [
    [`${best.name} est classé ${frenchRank(best.rank)} dans le même temps que ${winner.name}. Quel détail a le plus compté pour départager les coureurs ?`,
      `${best.name} finished ${englishRank(best.rank)} on the same time as ${winner.name}. What mattered most in the battle for places?`],
    [`${best.name} a le même temps officiel que ${winner.name}. Comment jugez-vous sa performance au vu de son classement ?`,
      `${best.name} shared the same official time as ${winner.name}. How do you rate his performance given where he placed?`],
  ]);
  if (best && facts.ahead && facts.ahead.rank > 1) {
    const ahead = facts.ahead;
    add("next-competitor", "race_fact", [
      [`${ahead.name} de ${ahead.team} termine une place devant ${best.name}. Qu’a-t-il mieux réussi aujourd’hui, selon vous ?`,
        `${ahead.name} of ${ahead.team} placed one spot ahead of ${best.name}. What do you think he did better today?`],
      [`${ahead.name} finit ${frenchRank(ahead.rank)}, une place devant ${best.name}. Qu’aurait pu faire votre coureur pour remonter au classement ?`,
        `${ahead.name} finished ${englishRank(ahead.rank)}, one place ahead of ${best.name}. What could your rider have done to finish higher?`],
    ]);
  }
  if (best && facts.individualTimeTrial) {
    const { ownTimeMs, gapAheadMs } = facts.individualTimeTrial;
    add("individual-time", "tactics", [
      [`${best.name} a bouclé le chrono en ${duration(ownTimeMs, "fr")}. Comment a-t-il géré son effort du départ à l’arrivée ?`,
        `${best.name} completed the time trial in ${duration(ownTimeMs, "en")}. How did he pace himself from start to finish?`],
      [`${best.name} signe un temps de ${duration(ownTimeMs, "fr")}. Qu’aimeriez-vous qu’il améliore pour son prochain contre-la-montre ?`,
        `${best.name} posted a time of ${duration(ownTimeMs, "en")}. What would you like him to improve for his next time trial?`],
    ]);
    if (gapAheadMs != null && gapAheadMs > 0 && facts.ahead) add("chrono-next-place", "result", [
      [`Il a manqué ${duration(gapAheadMs, "fr")} à ${best.name} pour devancer ${facts.ahead.name}. Où chercher ces secondes sur le prochain chrono ?`,
        `${best.name} was ${duration(gapAheadMs, "en")} short of beating ${facts.ahead.name}. Where could he find those seconds next time?`],
    ]);
  }
  if (starters > finishers && finishers > 0) add("finishers", "result", [
    [`Sur vos ${starters} coureurs au départ, ${finishers} figure${finishers > 1 ? "nt" : ""} au classement. Qu’est-ce qui a compliqué la course de votre équipe ?`,
      `${finishers} of your ${starters} starters were classified. What made the race difficult for your team?`],
  ]);
  if (facts.abandoned) add("abandonment", "race_fact", [
    [`${facts.abandoned} a abandonné. Comment va-t-il après la course ?`,
      `${facts.abandoned} did not finish. How is he doing after the race?`],
    [`L’abandon de ${facts.abandoned} va-t-il vous amener à revoir son programme de courses ?`,
      `Will ${facts.abandoned}'s withdrawal affect his upcoming race schedule?`],
  ]);
}

function addCourseQuestions(facts: PostRaceInterviewDetailedRaceFacts, add: AddQuestions) {
  const { breakaway, pursuit, caught, attack, combativity, best } = facts;
  if (breakaway) add("in-breakaway", "race_fact", [
    [`${breakaway.name} était dans l’échappée ${position(breakaway.km, "fr")}. Pensiez-vous que ce groupe pouvait aller au bout ?`,
      `${breakaway.name} was in the break ${position(breakaway.km, "en")}. Did you think the group could stay away?`],
    [`${breakaway.name} était à l’avant ${position(breakaway.km, "fr")}. Devait-il prendre des relais ou garder des forces ?`,
      `${breakaway.name} was up the road ${position(breakaway.km, "en")}. Did you want him to take turns or save his energy?`],
    [`${breakaway.name} était dans l’échappée ${position(breakaway.km, "fr")}. Sa présence à l’avant a-t-elle changé la tactique de votre équipe ?`,
      `${breakaway.name} was in the break ${position(breakaway.km, "en")}. Did having him up the road change your team's tactics?`],
  ]);
  if (pursuit) add("in-pursuit", "race_fact", [
    [`${pursuit.name} était dans le groupe de poursuite ${position(pursuit.km, "fr")}. Pensiez-vous qu’il pouvait revenir sur les coureurs de tête ?`,
      `${pursuit.name} was in the chase group ${position(pursuit.km, "en")}. Did you think he could catch the leaders?`],
    [`${pursuit.name} était dans le groupe de poursuite ${position(pursuit.km, "fr")}. Avait-il intérêt à prendre des relais pour réduire l’écart ?`,
      `${pursuit.name} was in the chase group ${position(pursuit.km, "en")}. Would taking turns to close the gap have helped him?`],
  ]);
  if (caught) add("caught", "race_fact", [
    [`${caught.name} est repris ${position(caught.km, "fr")}. Lui restait-il assez de forces pour repartir à l’attaque ?`,
      `${caught.name} was caught ${position(caught.km, "en")}. Did he have enough left to attack again?`],
    [`${caught.name} est repris ${position(caught.km, "fr")}. Qu’a apporté son passage à l’avant à votre équipe ?`,
      `${caught.name} was caught ${position(caught.km, "en")}. What did your team gain from having him up the road?`],
  ]);
  if (attack?.planned) add("prepared-attack", "tactics", [
    [`${attack.name} a lancé une attaque préparée ${position(attack.km, "fr")}. Pourquoi était-ce un bon moment pour attaquer ?`,
      `${attack.name} launched a planned attack ${position(attack.km, "en")}. Why was that a good moment to go?`],
    [`${attack.name} a lancé une attaque préparée ${position(attack.km, "fr")}. Qu’espériez-vous obtenir avec cette attaque ?`,
      `${attack.name} launched a planned attack ${position(attack.km, "en")}. What were you hoping to achieve with that move?`],
  ]);
  if (attack && !attack.planned) add("offensive", "tactics", [
    [`${attack.name} a attaqué ${position(attack.km, "fr")}. Qu’est-ce qui aurait pu rendre son attaque plus efficace ?`,
      `${attack.name} attacked ${position(attack.km, "en")}. What could have made his attack more effective?`],
    [`${attack.name} a attaqué ${position(attack.km, "fr")}. Vous attendiez-vous à le voir prendre cette initiative ?`,
      `${attack.name} attacked ${position(attack.km, "en")}. Did you expect him to make that move?`],
  ]);
  const mountainPrime = facts.primes.find((entry) => entry.type === "mountain");
  if (mountainPrime) add("mountain-prime", "race_fact", [
    [`${mountainPrime.name} a marqué ${mountainPrime.points} point${mountainPrime.points > 1 ? "s" : ""} de la montagne ${position(mountainPrime.km, "fr")}. Visiez-vous ces points au départ ?`,
      `${mountainPrime.name} scored ${mountainPrime.points} mountain point${mountainPrime.points > 1 ? "s" : ""} ${position(mountainPrime.km, "en")}. Were you targeting those points at the start?`],
    [`${mountainPrime.name} est passé ${frenchRank(mountainPrime.rank)} au sommet ${position(mountainPrime.km, "fr")}. Qu’avez-vous retenu de sa façon de courir dans cette montée ?`,
      `${mountainPrime.name} went over the summit ${englishRank(mountainPrime.rank)} ${position(mountainPrime.km, "en")}. What stood out about the way he rode the climb?`],
  ]);
  const sprintPrime = facts.primes.find((entry) => entry.type === "intermediate_sprint");
  if (sprintPrime) add("sprint-prime", "race_fact", [
    [`${sprintPrime.name} a marqué ${sprintPrime.points} point${sprintPrime.points > 1 ? "s" : ""} au sprint intermédiaire ${position(sprintPrime.km, "fr")}. Était-ce un objectif de votre équipe aujourd’hui ?`,
      `${sprintPrime.name} scored ${sprintPrime.points} point${sprintPrime.points > 1 ? "s" : ""} at the intermediate sprint ${position(sprintPrime.km, "en")}. Was that a target for your team today?`],
    [`${sprintPrime.name} a pris la ${sprintPrime.rank === 1 ? "première" : `${sprintPrime.rank}e`} place au sprint intermédiaire ${position(sprintPrime.km, "fr")}. Comment jugez-vous son placement à l’approche de la ligne ?`,
      `${sprintPrime.name} took ${englishRank(sprintPrime.rank)} at the intermediate sprint ${position(sprintPrime.km, "en")}. How do you rate his positioning on the approach to the line?`],
  ]);
  if (combativity) add("combativity", "result", [
    [`${combativity.name} reçoit le prix de la combativité. Quel moment de sa course résume le mieux l’énergie qu’il y a mise ?`,
      `${combativity.name} took the combativity award. Which moment best captured the energy he put into the stage?`],
    ...(combativity.breakawayKm === undefined ? [] : [[
      `${combativity.name} est désigné le plus combatif après ${Math.round(combativity.breakawayKm)} km à l’avant. Comment a-t-il fait pour tenir aussi longtemps ?`,
      `${combativity.name} won the combativity award after ${Math.round(combativity.breakawayKm)} km at the front. How did he manage to stay out there that long?`,
    ]] as const),
  ]);
  if (best && facts.winnerGapMs === 0 && facts.finishMode === "mass_sprint") add("mass-sprint", "tactics", [
    [`Dans cette arrivée au sprint massif, où vouliez-vous placer ${best.name} à l’entrée du dernier kilomètre ?`,
      `In that bunch sprint, where did you want ${best.name} positioned going into the final kilometre?`],
    [`L’arrivée s’est jouée au sprint massif. Comment jugez-vous le placement de ${best.name} à l’approche de la ligne ?`,
      `It came down to a bunch sprint. How do you rate ${best.name}'s positioning on the approach to the line?`],
  ]);
  if (best && facts.winnerGapMs === 0 && facts.finishMode === "reduced_sprint") add("reduced-sprint", "tactics", [
    [`L’arrivée s’est jouée au sprint d’un petit groupe. ${best.name} était-il bien placé à l’entrée de la dernière ligne droite ?`,
      `It came down to a small-group sprint. Was ${best.name} well positioned heading into the final straight?`],
    [`L’arrivée s’est jouée en petit comité. Quelle était la meilleure façon pour ${best.name} de défendre ses chances dans ce groupe ?`,
      `It came down to a small group. How could ${best.name} make the most of his chances in that group?`],
  ]);
  if (facts.lostContact) {
    const { name, km } = facts.lostContact;
    add("lost-contact", "race_fact", [
      [`${name} a perdu le contact avec son groupe ${position(km, "fr")}. Quelle difficulté a fait la différence à ce moment-là ?`,
        `${name} lost contact with his group ${position(km, "en")}. What made that part of the race so difficult for him?`],
      [`${name} a décroché ${position(km, "fr")}. A-t-il pu compter sur un équipier pour tenter de revenir ?`,
        `${name} dropped back ${position(km, "en")}. Was a teammate able to help him try to get back on?`],
    ]);
  }
}

const INCIDENT_QUESTIONS = {
  puncture: (name: string, fr: string, en: string) => [
    [`${name} a crevé ${fr}. Quel effet cette crevaison a-t-elle eu sur sa course ?`,
      `${name} punctured ${en}. How did it affect his race?`],
    [`${name} a crevé ${fr}. A-t-il pu reprendre le rythme rapidement ?`,
      `${name} punctured ${en}. Was he able to get back up to speed quickly?`],
  ],
  crosswind: (name: string, fr: string, en: string) => [
    [`Le peloton s’est coupé dans le vent de côté ${fr}, avec ${name} parmi les coureurs piégés. Votre équipe avait-elle anticipé ce risque ?`,
      `Crosswinds split the bunch ${en}, and ${name} was caught out. Had your team expected that risk?`],
    [`${name} a été piégé par une bordure ${fr}. Comment aurait-il pu mieux se placer avant ce passage exposé au vent ?`,
      `${name} was caught out in the crosswinds ${en}. How could he have positioned himself better before that exposed stretch?`],
  ],
  crash_individual: (name: string, fr: string, en: string) => [
    [`${name} est tombé ${fr}. Quelle information avez-vous cherchée en premier après sa chute ?`,
      `${name} crashed ${en}. What was the first thing you wanted to find out after the crash?`],
    [`${name} est tombé ${fr}. Cette chute vous a-t-elle obligé à revoir votre tactique ?`,
      `${name} crashed ${en}. Did that force you to change your tactics?`],
  ],
  crash_mass: (name: string, fr: string, en: string) => [
    [`${name} a été pris dans la chute collective ${fr}. Comment votre équipe a-t-elle réagi ?`,
      `${name} was involved in the mass crash ${en}. How did your team respond?`],
    [`${name} a été pris dans la chute collective ${fr}. Quelles conséquences cet incident a-t-il eues sur la course de votre équipe ?`,
      `${name} was involved in the mass crash ${en}. How did the incident affect your team's race?`],
  ],
} satisfies Record<RaceIncidentType, (name: string, fr: string, en: string) => QuestionPair[]>;

function addIncidentAndWorkQuestions(facts: PostRaceInterviewDetailedRaceFacts, add: AddQuestions) {
  for (const { name, km, type, finished, abandoned } of facts.incidents) {
    const fr = position(km, "fr");
    const en = position(km, "en");
    add(type, "race_fact", INCIDENT_QUESTIONS[type](name, fr, en));
    if (type !== "crash_mass" && type !== "crash_individual") continue;
    if (finished) add(`${type}-finished`, "race_fact", [
      [`${name} est tombé ${fr} et a terminé la course. Qu’est-ce qui l’a aidé à aller jusqu’à l’arrivée ?`,
        `${name} crashed ${en} and still finished. What helped him get to the finish?`],
    ]);
    if (abandoned) add(`${type}-abandoned`, "race_fact", [
      [`${name} a abandonné après sa chute ${fr}. Comment allez-vous gérer les prochains jours avec lui ?`,
        `${name} withdrew after his crash ${en}. How will you manage the next few days with him?`],
    ]);
  }
  for (const { kind, name, target, km } of facts.work) {
    const distanceFr = km.toLocaleString("fr", { maximumFractionDigits: 1 });
    const distanceEn = km.toLocaleString("en", { maximumFractionDigits: 1 });
    if (kind === "protection" && target) add("protection", "tactics", [
      [`${name} a protégé ${target} pendant ${distanceFr} km. En quoi son aide a-t-elle compté pour la suite de la course ?`,
        `${name} protected ${target} for ${distanceEn} km. What difference did that support make later in the race?`],
      [`${name} a protégé ${target} pendant ${distanceFr} km. Lui aviez-vous confié ce rôle avant le départ ?`,
        `${name} protected ${target} for ${distanceEn} km. Had you given him that role before the start?`],
    ]);
    if (kind === "recovery" && target) add("recovery", "tactics", [
      [`${name} a roulé pour aider ${target} à revenir. Pourquoi était-ce important pour votre équipe de le faire revenir ?`,
        `${name} worked to help ${target} get back. Why was it important for your team to get him back?`],
      [`${name} a roulé pour aider ${target} à revenir. Comment évaluez-vous le travail de votre équipier dans ce passage ?`,
        `${name} worked to help ${target} get back. How do you rate his work in that part of the race?`],
    ]);
    if (kind === "peloton") add("peloton-work", "tactics", [
      [`${name} a roulé ${distanceFr} km en tête du peloton. Quel était le but de votre équipe sur cette portion ?`,
        `${name} spent ${distanceEn} km working at the head of the bunch. What was your team trying to achieve on that stretch?`],
      [`${name} a pris des relais en tête du peloton. Ce travail a-t-il permis à l’équipe d’aborder la suite comme vous le souhaitiez ?`,
        `${name} took turns at the front of the bunch. Did that help the team approach the rest of the race as you had hoped?`],
    ]);
    if (kind === "leadout" && target) add("leadout", "tactics", [
      [`${name} a aidé à lancer le sprint de ${target}. Que pensez-vous du moment où votre sprinteur a lancé son effort ?`,
        `${name} helped lead out ${target}. What did you think of the timing of your sprinter's effort?`],
      [`${name} a aidé à lancer le sprint de ${target}. Êtes-vous satisfait de leur coordination dans le final ?`,
        `${name} helped lead out ${target}. Were you happy with how they worked together in the finish?`],
    ]);
  }
}

export function buildDetailedRaceInterviewQuestions(
  context: PostRaceInterviewContext,
): PostRaceInterviewQuestion[] {
  const facts = context.detailedRaceFacts;
  if (!facts) return [];
  const questions: PostRaceInterviewQuestion[] = [];
  const add: AddQuestions = (family, category, variants) => {
    const topic = RACE_TOPICS[family] ?? family;
    variants.forEach(([french, english], index) => {
      questions.push({ id: `race-detail-${family}-${index + 1}`, topic, category, text: french, textEn: english });
    });
  };

  addFinishQuestions(facts, add);
  addCourseQuestions(facts, add);
  addIncidentAndWorkQuestions(facts, add);
  return questions;
}

const RACE_TOPICS: Record<string, string> = {
  "team-time": "ttt",
  "team-gap": "ttt",
  "individual-time": "itt",
  "chrono-next-place": "itt",
  "prepared-attack": "attack",
  offensive: "attack",
  caught: "catch",
  "in-breakaway": "breakaway",
  "in-pursuit": "pursuit",
  "mass-sprint": "sprint",
  "reduced-sprint": "sprint",
  crash_mass: "crash",
  crash_individual: "crash",
  "crash_mass-finished": "crash",
  "crash_individual-finished": "crash",
  "crash_mass-abandoned": "crash",
  "crash_individual-abandoned": "crash",
};
