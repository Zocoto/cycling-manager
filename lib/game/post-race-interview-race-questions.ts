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
  const byId = new Map(own.map((result) => [result.riderId, result]));
  const isTeamTrial = stageType === "team_time_trial";
  const isIndividualTrial = stageType === "individual_time_trial" || stageType === "prologue";
  const abandon = own.find((result) => result.status === "did_not_finish");
  const facts: PostRaceInterviewDetailedRaceFacts = {
    starters: own.filter((result) => result.status !== "did_not_start" && result.status !== "withdrawn").length,
    finishers: own.filter((result) => result.status === "finished").length,
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
  if (isIndividualTrial && best?.elapsedTimeMs != null) {
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
    text: "Dans un chrono collectif, comment trouvez-vous l’équilibre entre la vitesse des relais et les coureurs à attendre ?",
    textEn: "In a team time trial, how do you balance fast rotations with waiting for the riders you need to keep together?",
  },
];

function addFinishQuestions(facts: PostRaceInterviewDetailedRaceFacts, add: AddQuestions) {
  const { best, second, winner, winnerGapMs, finishers, starters } = facts;
  if (facts.teamTimeTrial) {
    const { rank, timeMs, gapMs, winnerTeam } = facts.teamTimeTrial;
    add("team-time", "result", [
      [`Votre équipe signe le ${frenchRank(rank)} temps en ${duration(timeMs, "fr")}. Quel passage révèle le mieux la qualité de vos relais ?`,
        `Your squad finished ${englishRank(rank)} in ${duration(timeMs, "en")}. Which section best showed how well your riders rotated?`],
      [`Vous prenez la ${rank === 1 ? "première" : `${rank}e`} place au chrono collectif. Comment avez-vous réparti l’effort entre les rouleurs et les coureurs à protéger ?`,
        `You finished ${englishRank(rank)} in the team time trial. How did you split the work between your strongest time triallists and those you needed to protect?`],
    ]);
    if (gapMs > 0) add("team-gap", "tactics", [
      [`${winnerTeam} vous devance de ${duration(gapMs, "fr")}. Quel réglage de vos relais testeriez-vous au prochain chrono collectif ?`,
        `${winnerTeam} beat you by ${duration(gapMs, "en")}. What would you change about your rotations for the next team time trial?`],
      [`Il vous manque ${duration(gapMs, "fr")} sur ${winnerTeam}. Sur un autre parcours, garderiez-vous la même composition ?`,
        `You were ${duration(gapMs, "en")} behind ${winnerTeam}. Would you pick the same line-up on a different course?`],
    ]);
  }
  if (best) {
    add("best-place", "result", [
      [`${best.name} signe votre meilleur résultat avec sa ${best.rank === 1 ? "première" : `${best.rank}e`} place. Quelle décision de votre équipe a le plus pesé sur ce classement ?`,
        `${best.name} was your best finisher in ${englishRank(best.rank)}. Which team decision had the greatest impact on that placing?`],
      [`${best.name} finit ${frenchRank(best.rank)}. Quel moment de sa course aimeriez-vous revoir avec lui et pourquoi ?`,
        `${best.name} finished ${englishRank(best.rank)}. Which part of the race would you like to watch back with him, and why?`],
      [`À la lecture de la ${best.rank === 1 ? "première" : `${best.rank}e`} place de ${best.name}, quel détail se perd quand on ne regarde que le classement ?`,
        `Looking at ${best.name} in ${englishRank(best.rank)}, what does the results sheet fail to capture?`],
    ]);
  }
  if (best && second && second.rank <= 15) add("two-finishers", "result", [
    [`${best.name} termine ${frenchRank(best.rank)} et ${second.name} ${frenchRank(second.rank)}. Qu’est-ce qui les a aidés à signer deux résultats aussi solides le même jour ?`,
      `${best.name} finished ${englishRank(best.rank)} and ${second.name} ${englishRank(second.rank)}. What helped them both deliver such strong results on the same day?`],
    [`Deux de vos coureurs sont dans les quinze premiers avec ${best.name} et ${second.name}. Seriez-vous tenté de les associer de nouveau sur ce type de parcours ?`,
      `You had two riders in the top fifteen with ${best.name} and ${second.name}. Would you pair them again on this kind of course?`],
  ]);
  if (best && winner && winnerGapMs != null && winnerGapMs > 0) add("winner-margin", "result", [
    [`${best.name} termine à ${duration(winnerGapMs, "fr")} de ${winner.name}. Quelle partie de cet écart pensez-vous pouvoir réduire sur un parcours comparable ?`,
      `${best.name} finished ${duration(winnerGapMs, "en")} behind ${winner.name}. Where do you think you could reduce that gap on a similar course?`],
    [`${winner.name}, chez ${winner.team}, devance ${best.name} de ${duration(winnerGapMs, "fr")}. Qu’est-ce que vous retenez de la prestation de cette équipe ?`,
      `${winner.name} of ${winner.team} beat ${best.name} by ${duration(winnerGapMs, "en")}. What did you take away from that team's performance?`],
  ]);
  if (best && winner && winnerGapMs === 0) add("same-finish-time", "result", [
    [`${best.name} est classé ${frenchRank(best.rank)} dans le même temps que ${winner.name}. Quel détail a le plus compté pour départager les coureurs ?`,
      `${best.name} finished ${englishRank(best.rank)} on the same time as ${winner.name}. What mattered most in the battle for places?`],
    [`${best.name} et ${winner.name} ont le même temps officiel. Quelle indication aviez-vous donnée à votre coureur pour gagner quelques places à l’arrivée ?`,
      `${best.name} and ${winner.name} recorded the same official time. What guidance did you give your rider about gaining positions at the finish?`],
  ]);
  if (best && facts.ahead && facts.ahead.name !== winner?.name) {
    const ahead = facts.ahead;
    add("next-competitor", "race_fact", [
      [`${ahead.name} de ${ahead.team} termine juste devant ${best.name} au classement. Qu’avez-vous remarqué dans sa façon d’aborder ce parcours ?`,
        `${ahead.name} of ${ahead.team} placed one spot ahead of ${best.name}. What did you notice about how he approached this course?`],
      [`${ahead.team} place ${ahead.name} ${frenchRank(ahead.rank)}, une place devant ${best.name}. Quelle différence de stratégie avez-vous pu observer entre les deux équipes ?`,
        `${ahead.team}'s ${ahead.name} finished ${englishRank(ahead.rank)}, one place ahead of ${best.name}. What did you notice about the two teams' approaches?`],
    ]);
  }
  if (best && facts.individualTimeTrial) {
    const { ownTimeMs, gapAheadMs } = facts.individualTimeTrial;
    add("individual-time", "tactics", [
      [`${best.name} a bouclé le chrono en ${duration(ownTimeMs, "fr")}. Comment avait-il prévu de répartir son effort entre le départ et le retour vers la ligne ?`,
        `${best.name} completed the time trial in ${duration(ownTimeMs, "en")}. How did he plan to pace the effort from the start to the run-in?`],
      [`Sur son chrono de ${duration(ownTimeMs, "fr")}, quel passage donneriez-vous à revoir à ${best.name} pour son prochain contre-la-montre ?`,
        `Looking back at his ${duration(ownTimeMs, "en")} ride, which section would you ask ${best.name} to study before his next time trial?`],
    ]);
    if (gapAheadMs != null && gapAheadMs > 0 && facts.ahead) add("chrono-next-place", "result", [
      [`Il a manqué ${duration(gapAheadMs, "fr")} à ${best.name} pour devancer ${facts.ahead.name}. Où chercher ces secondes sur le prochain chrono ?`,
        `${best.name} was ${duration(gapAheadMs, "en")} short of beating ${facts.ahead.name}. Where could he find those seconds next time?`],
    ]);
  }
  if (starters > finishers && finishers > 0) add("finishers", "result", [
    [`Votre équipe compte ${finishers} classé${finishers > 1 ? "s" : ""} à l’arrivée pour ${starters} au départ. Quel bilan faites-vous de cette arrivée pour l’ensemble du groupe ?`,
      `${finishers} of your ${starters} starters were classified. How do you assess the finish for the whole squad?`],
  ]);
  if (facts.abandoned) add("abandonment", "race_fact", [
    [`${facts.abandoned} a abandonné. Quel a été votre premier réflexe dans la voiture ?`,
      `${facts.abandoned} did not finish. What was your first response in the team car?`],
    [`Après l’abandon de ${facts.abandoned}, quel message avez-vous voulu faire passer à ses équipiers encore en course ?`,
      `After ${facts.abandoned} withdrew, what did you want to tell his teammates who were still racing?`],
  ]);
}

function addCourseQuestions(facts: PostRaceInterviewDetailedRaceFacts, add: AddQuestions) {
  const { breakaway, pursuit, caught, attack, combativity, best } = facts;
  if (breakaway) add("in-breakaway", "race_fact", [
    [`${breakaway.name} figurait dans l’échappée ${position(breakaway.km, "fr")}. À partir de quand avez-vous pensé que ce groupe pouvait aller au bout ?`,
      `${breakaway.name} was in the break ${position(breakaway.km, "en")}. When did you think that group might stay away?`],
    [`On retrouve ${breakaway.name} à l’avant ${position(breakaway.km, "fr")}. Quelles consignes lui avez-vous données sur la fréquence de ses relais ?`,
      `${breakaway.name} was up the road ${position(breakaway.km, "en")}. What did you tell him about how often to take a turn?`],
    [`Quand ${breakaway.name} se retrouve dans l’échappée ${position(breakaway.km, "fr")}, qu’est-ce que sa présence à l’avant permet à ses équipiers de faire derrière ?`,
      `With ${breakaway.name} in the break ${position(breakaway.km, "en")}, what options did that give his teammates behind?`],
  ]);
  if (pursuit) add("in-pursuit", "race_fact", [
    [`${pursuit.name} est dans le groupe de poursuite ${position(pursuit.km, "fr")}. Quels signes lui permettaient de juger si la jonction était encore réaliste ?`,
      `${pursuit.name} was in the chase ${position(pursuit.km, "en")}. What signs helped him judge whether he could still make it across?`],
    [`Avec ${pursuit.name} dans la poursuite ${position(pursuit.km, "fr")}, à quelles conditions lui demandiez-vous de prendre ses relais ?`,
      `With ${pursuit.name} in the chase ${position(pursuit.km, "en")}, what conditions would prompt you to ask him to take a turn?`],
  ]);
  if (caught) add("caught", "race_fact", [
    [`${caught.name} est repris ${position(caught.km, "fr")}. Comment décide-t-on à ce moment de repartir ou de se remettre dans les roues ?`,
      `${caught.name} was caught ${position(caught.km, "en")}. How do you decide in that moment whether to go again or sit in?`],
    [`Après la reprise de ${caught.name} ${position(caught.km, "fr")}, quel rôle espériez-vous encore lui confier dans le final ?`,
      `After ${caught.name} was caught ${position(caught.km, "en")}, what role did you still hope he could play in the finale?`],
  ]);
  if (attack?.planned) add("prepared-attack", "tactics", [
    [`${attack.name} a lancé l’attaque préparée ${position(attack.km, "fr")}. Quel détail du parcours vous avait fait choisir ce point précis ?`,
      `${attack.name} launched the planned attack ${position(attack.km, "en")}. What about the route made you pick that exact spot?`],
    [`Lors de l’attaque préparée de ${attack.name} ${position(attack.km, "fr")}, quelle réaction attendiez-vous des autres équipes ?`,
      `When ${attack.name} launched the planned attack ${position(attack.km, "en")}, how did you expect the other teams to react?`],
  ]);
  if (attack && !attack.planned) add("offensive", "tactics", [
    [`Le journal de course relève une offensive de ${attack.name} ${position(attack.km, "fr")}. Quelle ouverture a-t-il vue à ce moment-là ?`,
      `The race log records an offensive move by ${attack.name} ${position(attack.km, "en")}. What opening did he see at that moment?`],
    [`${attack.name} passe à l’offensive ${position(attack.km, "fr")}. Était-ce le moment que vous aviez en tête avant le départ ?`,
      `${attack.name} made his move ${position(attack.km, "en")}. Was that the moment you had in mind before the start?`],
  ]);
  const mountainPrime = facts.primes.find((entry) => entry.type === "mountain");
  if (mountainPrime) add("mountain-prime", "race_fact", [
    [`${mountainPrime.name} a pris ${mountainPrime.points} point${mountainPrime.points > 1 ? "s" : ""} au GPM ${position(mountainPrime.km, "fr")}. Quel intérêt aviez-vous à jouer ce sommet ?`,
      `${mountainPrime.name} collected ${mountainPrime.points} mountain point${mountainPrime.points > 1 ? "s" : ""} ${position(mountainPrime.km, "en")}. What was your incentive to contest that summit?`],
    [`${mountainPrime.name} passe ${frenchRank(mountainPrime.rank)} au GPM ${position(mountainPrime.km, "fr")}. Comment arbitrez-vous entre les points de la montagne et les forces à garder pour l’arrivée ?`,
      `${mountainPrime.name} crossed the mountain prime ${englishRank(mountainPrime.rank)} ${position(mountainPrime.km, "en")}. How do you balance mountain points against keeping something for the finish?`],
  ]);
  const sprintPrime = facts.primes.find((entry) => entry.type === "intermediate_sprint");
  if (sprintPrime) add("sprint-prime", "race_fact", [
    [`${sprintPrime.name} a marqué ${sprintPrime.points} point${sprintPrime.points > 1 ? "s" : ""} au sprint intermédiaire ${position(sprintPrime.km, "fr")}. Quelle place ce sprint avait-il dans votre plan ?`,
      `${sprintPrime.name} scored ${sprintPrime.points} point${sprintPrime.points > 1 ? "s" : ""} at the intermediate sprint ${position(sprintPrime.km, "en")}. How did that sprint fit into your plan?`],
    [`${sprintPrime.name} a pris la ${sprintPrime.rank === 1 ? "première" : `${sprintPrime.rank}e`} place au sprint intermédiaire ${position(sprintPrime.km, "fr")}. Quand avez-vous su qu’il aurait une chance d’y prendre des points ?`,
      `${sprintPrime.name} took ${englishRank(sprintPrime.rank)} at the intermediate sprint ${position(sprintPrime.km, "en")}. When did you know he had a chance to score there?`],
  ]);
  if (combativity) add("combativity", "result", [
    [`${combativity.name} reçoit le prix de la combativité. Quel moment de sa course résume le mieux l’énergie qu’il y a mise ?`,
      `${combativity.name} took the combativity award. Which moment best captured the energy he put into the stage?`],
    ...(combativity.breakawayKm === undefined ? [] : [[
      `${combativity.name} est désigné le plus combatif après ${Math.round(combativity.breakawayKm)} km à l’avant. Quels conseils lui avez-vous donnés pour gérer ses relais ?`,
      `${combativity.name} won the combativity award after ${Math.round(combativity.breakawayKm)} km at the front. What advice did you give him about managing his turns?`,
    ]] as const),
  ]);
  if (best && facts.winnerGapMs === 0 && facts.finishMode === "mass_sprint") add("mass-sprint", "tactics", [
    [`Dans cette arrivée au sprint massif, où vouliez-vous placer ${best.name} à l’entrée du dernier kilomètre ?`,
      `In that bunch sprint, where did you want ${best.name} positioned going into the final kilometre?`],
    [`Le sprint s’est joué au milieu d’un gros peloton. Pour ${best.name}, quel repère de placement était le plus utile ?`,
      `It came down to a bunch sprint. What was the most useful positioning cue for ${best.name}?`],
  ]);
  if (best && facts.winnerGapMs === 0 && facts.finishMode === "reduced_sprint") add("reduced-sprint", "tactics", [
    [`L’arrivée s’est jouée au sprint d’un groupe réduit. Pour ${best.name}, en quoi ce final demandait-il un autre placement qu’un sprint massif ?`,
      `It came down to a reduced-group sprint. How did that change the positioning demands for ${best.name} compared with a bunch sprint?`],
    [`Sur ce sprint en petit comité, quel adversaire ${best.name} devait-il surveiller en priorité ?`,
      `In that small-group finish, which opponent did ${best.name} most need to watch?`],
  ]);
  if (facts.lostContact) {
    const { name, km } = facts.lostContact;
    add("lost-contact", "race_fact", [
      [`Le journal signale que ${name} perd le contact ${position(km, "fr")}. Quel élément de ce passage aimeriez-vous revoir avec lui ?`,
        `The race log shows ${name} losing contact ${position(km, "en")}. What would you like to go over with him about that section?`],
      [`Quand ${name} décroche ${position(km, "fr")}, quels éléments vous font choisir entre demander du soutien ou laisser courir ses équipiers ?`,
        `When ${name} loses contact ${position(km, "en")}, what helps you decide between sending support or letting his teammates race on?`],
    ]);
  }
}

const INCIDENT_QUESTIONS = {
  puncture: (name: string, fr: string, en: string) => [
    [`${name} a subi une crevaison ou une avarie ${fr}. Comment décide-t-on vite si un équipier doit décrocher pour l’aider ?`,
      `${name} had a puncture or mechanical ${en}. How do you decide quickly whether a teammate should drop back to help?`],
    [`Après l’incident mécanique de ${name} ${fr}, qu’est-ce que la voiture doit surveiller en priorité ?`,
      `After ${name}'s mechanical ${en}, what does the team car have to watch most closely?`],
  ],
  crosswind: (name: string, fr: string, en: string) => [
    [`${name} a été pris dans une bordure ${fr}. Quel signal donnez-vous aux coureurs quand le placement devient aussi important que les jambes ?`,
      `${name} was caught out in the crosswinds ${en}. What signal do you give when positioning becomes as important as the legs?`],
    [`La bordure a touché ${name} ${fr}. Qu’auriez-vous aimé que votre équipe change dans son placement à l’approche de ce secteur ?`,
      `The crosswinds caught ${name} out ${en}. What would you have liked your team to change about its positioning on the approach?`],
  ],
  crash_individual: (name: string, fr: string, en: string) => [
    [`${name} est tombé ${fr}. Quelle information avez-vous cherchée en premier après sa chute ?`,
      `${name} crashed ${en}. What was the first thing you wanted to find out after the crash?`],
    [`Après la chute de ${name} ${fr}, comment avez-vous décidé des consignes à donner au reste de l’équipe ?`,
      `After ${name}'s crash ${en}, how did you decide what to tell the rest of the team?`],
  ],
  crash_mass: (name: string, fr: string, en: string) => [
    [`${name} a été impliqué dans la chute collective ${fr}. Comment avez-vous compté vos coureurs et réorganisé l’équipe dans la foulée ?`,
      `${name} was involved in the mass crash ${en}. How did you locate your riders and reorganise the team afterwards?`],
    [`Dans la confusion de la chute collective ${fr}, qu’avez-vous demandé aux équipiers de ${name} ?`,
      `In the confusion after the mass crash ${en}, what did you ask of ${name}'s teammates?`],
  ],
} satisfies Record<RaceIncidentType, (name: string, fr: string, en: string) => QuestionPair[]>;

function addIncidentAndWorkQuestions(facts: PostRaceInterviewDetailedRaceFacts, add: AddQuestions) {
  for (const { name, km, type, finished, abandoned } of facts.incidents) {
    const fr = position(km, "fr");
    const en = position(km, "en");
    add(type, "race_fact", INCIDENT_QUESTIONS[type](name, fr, en));
    if (type !== "crash_mass" && type !== "crash_individual") continue;
    if (finished) add(`${type}-finished`, "race_fact", [
      [`Tombé ${fr}, ${name} a tout de même terminé. Que vous a-t-il raconté sur les kilomètres qui ont suivi ?`,
        `After crashing ${en}, ${name} still finished. What did he tell you about the kilometres that followed?`],
    ]);
    if (abandoned) add(`${type}-abandoned`, "race_fact", [
      [`${name} a abandonné après sa chute ${fr}. Quelle est la priorité pour lui une fois l’arrivée passée ?`,
        `${name} withdrew after his crash ${en}. What is the priority for him once the race is over?`],
    ]);
  }
  for (const { kind, name, target, km } of facts.work) {
    const distance = Math.round(km);
    if (kind === "protection" && target) add("protection", "tactics", [
      [`Le suivi de course relève ${distance} km de protection de ${name} pour ${target} sur un même passage. Quel travail lui aviez-vous demandé à cet endroit ?`,
        `The race log records ${distance} km in which ${name} protected ${target} in one stretch. What work did you ask of him there?`],
      [`${name} a protégé ${target} pendant ${distance} km sur un même passage. Comment décidez-vous à quel moment un équipier peut passer le relais à un autre ?`,
        `${name} protected ${target} for ${distance} km in one stretch. How do you decide when a teammate can hand over to another rider?`],
    ]);
    if (kind === "recovery" && target) add("recovery", "tactics", [
      [`${name} a roulé pour aider ${target} à revenir. Qu’est-ce qui justifiait de mobiliser un équipier à ce moment ?`,
        `${name} worked to help ${target} get back. What made it worth using a teammate at that point?`],
      [`Quand ${name} a prêté main-forte à ${target}, quel retour attendiez-vous de leur part à l’oreillette ?`,
        `When ${name} went to help ${target}, what feedback were you expecting over the radio?`],
    ]);
    if (kind === "peloton") add("peloton-work", "tactics", [
      [`${name} a travaillé ${distance} km en tête du peloton sur un même passage. Qu’essayiez-vous d’obtenir en prenant la responsabilité de l’allure ?`,
        `${name} spent ${distance} km working at the head of the bunch in one stretch. What were you looking to achieve by taking responsibility for the pace?`],
      [`Quand ${name} a pris des relais en tête du peloton, comment avez-vous décidé jusqu’où l’engager avant de garder ses forces pour la suite ?`,
        `When ${name} was pulling at the front of the bunch, how far did you ask him to go before saving something for later?`],
    ]);
    if (kind === "leadout" && target) add("leadout", "tactics", [
      [`${name} a participé au lancement de ${target}. Au moment de travailler ensemble, quel était leur repère pour se passer le relais ?`,
        `${name} helped lead out ${target}. How did they know when to hand over to each other?`],
      [`${name} a contribué au train de ${target}. Avec le recul, qu’est-ce que vous garderiez de leur coordination ?`,
        `${name} worked in ${target}'s lead-out. Looking back, what would you keep about how they coordinated?`],
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
