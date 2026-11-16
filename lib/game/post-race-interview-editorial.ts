import type {
  PostRaceInterviewContext,
  PostRaceInterviewQuestion,
} from "./post-race-interview";

type EditorialRiderMove = {
  riderName: string;
  otherTeamName?: string | null;
  gameDay: number;
  isSale?: boolean;
};

export type PostRaceInterviewEditorialFacts = {
  recentArrival?: EditorialRiderMove;
  recentDeparture?: EditorialRiderMove;
  seasonLeader?: {
    riderId?: string;
    riderName: string;
    daysRaced: number;
    wins: number;
    topTenFinishes: number;
  };
  opponent?: {
    teamId: string;
    teamName: string;
    riderName: string;
    rank: number;
    gapToOwnSeconds?: number | null;
    ownRiderRank?: number | null;
    sameTimeAsOwn?: boolean;
    teammateFinishesInTopTen?: number;
  };
};

type InterviewCopy = [id: string, text: string, textEn: string];

function formatOrdinal(rank: number) {
  return rank === 1 ? "1er" : `${rank}e`;
}

function formatEnglishOrdinal(rank: number) {
  const lastTwo = rank % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13
    ? "th"
    : (["th", "st", "nd", "rd"][rank % 10] ?? "th");
  return `${rank}${suffix}`;
}

function formatTimeGap(seconds: number, locale: "fr-FR" | "en-GB") {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round((seconds % 60) * 1000) / 1000;
  const secondsLabel = remainingSeconds.toLocaleString(locale, {
    maximumFractionDigits: 3,
  });
  if (minutes === 0) return `${secondsLabel} s`;
  return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${secondsLabel} s`;
}

export function buildPostRaceEditorialQuestions(
  context: PostRaceInterviewContext,
): PostRaceInterviewQuestion[] {
  const candidates: PostRaceInterviewQuestion[] = [];
  const add = (
    category: PostRaceInterviewQuestion["category"],
    topic: string,
    questions: InterviewCopy[],
  ) => {
    for (const [id, text, textEn] of questions) {
      candidates.push({ id, category, topic, text, textEn });
    }
  };

  if ((context.questionVersion ?? 0) >= 4) {
    add("transfers", "transfers-future", [
      [
        "transfer-future-scouting",
        "Quand vous repérez un coureur à recruter, qu’est-ce que vous regardez en course en dehors de son classement ?",
        "When you scout a potential signing, what do you look for in a race besides their finishing position?",
      ],
      [
        "transfer-future-swap-or-buy",
        "Si un coureur vous intéresse, qu’est-ce qui vous ferait proposer un échange de coureurs plutôt que de payer une indemnité de transfert ?",
        "If you wanted to sign a rider, what would make you offer a rider swap rather than pay a transfer fee?",
      ],
      [
        "transfer-future-promote",
        "Si vous devez renforcer l’équipe pour un type de course, qu’est-ce qui vous ferait donner sa chance à un de vos coureurs plutôt que recruter ?",
        "If you needed to strengthen the team for a particular type of race, what would make you give one of your current riders a chance rather than sign someone?",
      ],
      [
        "transfer-future-specialist-or-versatile",
        "Pour votre prochain recrutement, préféreriez-vous un spécialiste, comme un sprinteur ou un grimpeur, ou un coureur polyvalent ? Pourquoi ?",
        "For your next signing, would you prefer a specialist such as a sprinter or climber, or an all-rounder? Why?",
      ],
    ]);

    const rank = context.bestRank;
    if (rank !== null && Number.isInteger(rank) && rank > 0) {
      const subject = context.stageType === "team_time_trial" ? context.teamName : context.riderName;
      const result = `${subject} termine à la ${rank === 1 ? "1re" : `${rank}e`} place.`;
      const resultEn = `${subject} finishes ${formatEnglishOrdinal(rank)}.`;
      add("season", "season-next-block", [
        [
          "season-next-block-measure",
          `${result} Que regarderez-vous sur les prochaines courses pour savoir si l’équipe progresse ?`,
          `${resultEn} What will you look for in the next few races to tell whether the team is improving?`,
        ],
        [
          "season-next-block-calendar",
          `${result} Ce résultat vous donne-t-il envie de revoir votre programme pour les prochaines semaines ?`,
          `${resultEn} Does this result make you want to change your race programme for the next few weeks?`,
        ],
        [
          "season-next-block-rotation",
          `${result} Quel sera votre premier critère pour sélectionner vos coureurs sur un parcours similaire ?`,
          `${resultEn} What will matter most when you pick your riders for a similar course?`,
        ],
        [
          "season-next-block-test",
          `${result} Qu’aimeriez-vous essayer lors de la prochaine épreuve de ce type ?`,
          `${resultEn} What would you like to try the next time you race on a similar course?`,
        ],
      ]);
    }
  }

  const facts = context.editorialFacts;
  if (!facts) return candidates;

  const arrival = facts.recentArrival;
  if (arrival) {
    const rider = arrival.riderName;
    const joined = `${rider} a rejoint votre effectif à J${arrival.gameDay}.`;
    const joinedEn = `${rider} joined your squad on day ${arrival.gameDay}.`;
    add("transfers", "transfers-arrival", [
      [
        "arrival-first-mission",
        `${joined} Quel rôle aimeriez-vous lui confier pour ses premières courses avec l’équipe ?`,
        `${joinedEn} What role would you like him to take in his first races with the team?`,
      ],
      [
        "arrival-hidden-criterion",
        `Qu’est-ce qui vous a convaincu de recruter ${rider} ?`,
        `What convinced you to sign ${rider}?`,
      ],
      [
        "arrival-change-of-plan",
        `L’arrivée de ${rider} vous donne-t-elle une nouvelle option tactique en course ?`,
        `Does signing ${rider} give your team a new tactical option in races?`,
      ],
      [
        "arrival-room-to-grow",
        `Sur quel type de parcours laisseriez-vous ${rider} courir pour son propre résultat ?`,
        `What kind of course would suit ${rider} if you let him ride for his own result?`,
      ],
      [
        "arrival-long-term",
        `À la fin de la saison, quel signe vous ferait dire que ${rider} s’est vraiment fait une place dans l’équipe ?`,
        `By the end of the season, what would show you that ${rider} had found his place on the team?`,
      ],
      [
        "arrival-roster-balance",
        `${joined} Voyez-vous en lui un leader, un équipier ou un coureur capable de remplir les deux rôles ?`,
        `${joinedEn} Do you see him as a leader, a support rider, or someone who can do both?`,
      ],
    ]);
    if (arrival.otherTeamName) {
      add("transfers", "transfers-arrival", [
        [
          "arrival-from-team",
          `${rider} arrive de ${arrival.otherTeamName}. Qu’est-ce qui vous avait marqué dans sa façon de courir avec cette équipe ?`,
          `${rider} has joined from ${arrival.otherTeamName}. What stood out about the way he raced for them?`,
        ],
        [
          "arrival-new-role",
          `Quel rôle aimeriez-vous proposer à ${rider} après son passage chez ${arrival.otherTeamName} ?`,
          `What role would you like to offer ${rider} after his time at ${arrival.otherTeamName}?`,
        ],
        [
          "arrival-opposite-cars",
          `Qu’est-ce que l’expérience de ${rider} chez ${arrival.otherTeamName} pourrait apporter à vos coureurs ?`,
          `What could your riders learn from ${rider}’s time at ${arrival.otherTeamName}?`,
        ],
      ]);
    }
  }

  const departure = facts.recentDeparture;
  if (departure) {
    const rider = departure.riderName;
    const left = `${rider} a quitté l’effectif à J${departure.gameDay}.`;
    const leftEn = `${rider} left the squad on day ${departure.gameDay}.`;
    add("transfers", "transfers-departure", [
      [
        "departure-replace-role",
        `${left} Qui pourrait reprendre son rôle en course ?`,
        `${leftEn} Who could take over his role in races?`,
      ],
      [
        "departure-promote-internally",
        `Après le départ de ${rider}, comptez-vous donner sa chance à un coureur de l’équipe ou chercher un renfort ?`,
        `With ${rider} leaving, a spot has opened up. Would you give someone already in the team a chance or go back to the transfer market?`,
      ],
      [
        "departure-decision-in-hindsight",
        `Qu’avez-vous appris sur votre effectif depuis le départ de ${rider} ?`,
        `What have you learned about your squad since ${rider} left?`,
      ],
      [
        "departure-slot-in-calendar",
        `${left} Son départ change-t-il votre préparation pour une course à venir ?`,
        `${leftEn} Is there a race this season you’ll prepare for differently now that he’s gone?`,
      ],
      [
        "departure-rebuild-different",
        `Si vous recrutez pour remplacer ${rider}, chercherez-vous un coureur capable de remplir le même rôle ?`,
        `If you sign a replacement for ${rider}, will you look for someone who can fill the same role?`,
      ],
    ]);
    if (departure.otherTeamName) {
      add("transfers", "transfers-departure", [
        [
          "departure-face-former-rider",
          `${rider} court désormais pour ${departure.otherTeamName}. Sur quel type de parcours sera-t-il le plus difficile à battre ?`,
          `${rider} now rides for ${departure.otherTeamName}. What kind of course would make him hardest to beat?`,
        ],
        [
          "departure-opponent-advantage",
          `Dans quel rôle ${rider} pourrait-il le plus aider sa nouvelle équipe, ${departure.otherTeamName} ?`,
          `In what role could ${rider} do the most to help his new team, ${departure.otherTeamName}?`,
        ],
        [
          "departure-former-team-knowledge",
          `${rider} est parti chez ${departure.otherTeamName}. Bien connaître sa façon de courir vous aidera-t-il quand vous le retrouverez en course ?`,
          `${rider} has moved to ${departure.otherTeamName}. Will knowing how he races help you when you face him again?`,
        ],
      ]);
    }
    if (departure.isSale) {
      add("transfers", "transfers-sale", [
        [
          "sale-value",
          `Si vous utilisez l’argent de la vente de ${rider} pour recruter, quelle qualité chercherez-vous chez le prochain coureur ?`,
          `If you use the fee for ${rider} to sign another rider, what quality will you look for first?`,
        ],
        [
          "sale-reinvest",
          `Après la vente de ${rider}, voulez-vous recruter tout de suite ou attendre ? Qu’est-ce qui guidera votre décision ?`,
          `After selling ${rider}, would you sign someone now or wait? What will guide your decision?`,
        ],
        [
          "sale-sporting-impact",
          `Après la vente de ${rider}, de quoi votre équipe risque-t-elle de manquer en course ?`,
          `After selling ${rider}, what might your team be missing in races?`,
        ],
      ]);
    }
  }

  if (arrival && departure && arrival.riderName !== departure.riderName) {
    add("transfers", "transfers-market", [
      [
        "transfer-roster-difference",
        `${departure.riderName} est parti et ${arrival.riderName} a rejoint l’équipe. Sur quel type de parcours ces mouvements changent-ils vos chances de jouer la victoire ?`,
        `${departure.riderName} has left and ${arrival.riderName} has joined. On what kind of course do those moves change your chances of winning?`,
      ],
      [
        "transfer-market-tradeoff",
        `${departure.riderName} est parti et ${arrival.riderName} a rejoint l’équipe. Ces mouvements vont-ils changer votre façon de sélectionner les coureurs pour une course ?`,
        `${departure.riderName} has left and ${arrival.riderName} has joined. Will those moves change how you pick a race lineup?`,
      ],
      [
        "transfer-changing-identity",
        `Après le départ de ${departure.riderName} et l’arrivée de ${arrival.riderName}, quel type de course voulez-vous privilégier avec votre nouvel effectif ?`,
        `With ${departure.riderName} gone and ${arrival.riderName} in the squad, what kind of race would you like to prioritise?`,
      ],
    ]);
  }

  const leader = facts.seasonLeader;
  if (leader && leader.daysRaced >= 5) {
    const rider = leader.riderName;
    const leaderRankToday = context.stageType !== "team_time_trial"
      && leader.riderId && leader.riderId === context.riderId
      ? context.bestRank
      : null;
    const leaderMadeTopTenToday = leaderRankToday !== null
      && leaderRankToday > 0 && leaderRankToday <= 10;
    const noWins = `Avant cette épreuve, ${rider} avait couru ${leader.daysRaced} jours en individuel cette saison, sans victoire d’étape ni de classique.`;
    const noWinsEn = `Before this race, ${rider} had ${leader.daysRaced} days of individual racing this season without winning a stage or a one-day race.`;

    if (leader.wins === 0 && leaderRankToday !== 1) {
      add("season", "season-leader", [
        [
          "season-leader-calendar",
          `${noWins} Où aurait-il le plus de chances de gagner une étape ou une classique cette saison ?`,
          `${noWinsEn} Where would he have the best chance of winning a stage or one-day race this season?`,
        ],
        [
          "season-leader-plan-b",
          `${noWins} Envisagez-vous de confier le rôle de leader à un autre coureur sur certaines épreuves ?`,
          `${noWinsEn} Are you considering letting another rider lead the team in some races?`,
        ],
        [
          "season-leader-small-signal",
          `${noWins} Quel signe en course vous montrerait qu’il se rapproche d’une victoire ?`,
          `${noWinsEn} What would you need to see in a race to feel that he’s getting closer to a win?`,
        ],
        [
          "season-leader-support",
          `${noWins} De quel soutien aurait-il besoin de la part de ses équipiers pour jouer la victoire ?`,
          `${noWinsEn} What support would he need from his teammates to compete for a win?`,
        ],
        [
          "season-leader-trust",
          `${noWins} Quelle qualité travailleriez-vous en priorité pour l’aider à gagner ?`,
          `${noWinsEn} What would you work on first to help him win?`,
        ],
        [
          "season-leader-opportunity",
          `${noWins} Préférez-vous lui faire essayer un autre type de parcours ou mieux l’entourer sur ceux qui lui conviennent déjà ?`,
          `${noWinsEn} Would you give him a chance on unfamiliar terrain or strengthen the support on courses that suit him best?`,
        ],
      ]);
      if (leader.topTenFinishes === 0 && !leaderMadeTopTenToday) {
        add("season", "season-leader", [
          [
            "season-leader-no-top-ten",
            `Avant cette épreuve, ${rider} n’avait pas encore signé de top 10 en ${leader.daysRaced} jours de course en individuel cette saison. Quel premier objectif lui fixeriez-vous ?`,
            `Before this race, ${rider} had no individual top-ten finish from ${leader.daysRaced} days of racing this season. What intermediate goal would you set him?`,
          ],
          [
            "season-leader-measure-progress",
            `${rider} abordait cette épreuve sans top 10 en individuel cette saison. Que voudriez-vous voir lors de sa prochaine course pour mesurer ses progrès ?`,
            `${rider} started this race without an individual top-ten finish this season. What would you look for in his next race to gauge his progress?`,
          ],
          [
            "season-leader-adjust-pressure",
            `Avant cette épreuve, ${rider} avait déjà couru ${leader.daysRaced} jours en individuel sans top 10. Quel rôle lui donneriez-vous lors de sa prochaine sortie ?`,
            `With ${leader.daysRaced} days of individual racing and no top-ten finish before today, what job would you give ${rider} on his next outing?`,
          ],
        ]);
      } else if (leader.topTenFinishes >= 2) {
        add("season", "season-leader", [
          [
            "season-leader-convert",
            `Avant cette épreuve, ${rider} comptait ${leader.topTenFinishes} top 10 en individuel cette saison, sans victoire d’étape ni de classique. Que lui manque-t-il pour jouer la victoire dans un final ?`,
            `Before this race, ${rider} had ${leader.topTenFinishes} individual top-ten finishes but no stage or one-day win this season. What would help him fight for a win in the closing kilometres?`,
          ],
          [
            "season-leader-last-step",
            `${rider} avait déjà signé ${leader.topTenFinishes} top 10 en individuel avant cette course. Sur quoi mettriez-vous l’accent pour l’aider à viser plus haut ?`,
            `${rider} already had ${leader.topTenFinishes} individual top-ten finishes before this race. What would you work on to help him aim higher?`,
          ],
          [
            "season-leader-break-pattern",
            `${rider} avait signé ${leader.topTenFinishes} top 10 en individuel avant cette épreuve, sans gagner d’étape ni de classique cette saison. Quel type de finale lui donnerait la meilleure occasion de changer ce bilan ?`,
            `${rider} came into this race with ${leader.topTenFinishes} individual top-ten finishes and no stage or one-day win this season. What kind of finale would offer the best chance to change that?`,
          ],
        ]);
      }
    } else if (leader.wins > 0) {
      const winningRecord = leader.wins === 1
        ? "une victoire d’étape ou de classique"
        : `${leader.wins} victoires d’étape ou de classique`;
      const winningRecordEn = leader.wins === 1
        ? "one stage or one-day win"
        : `${leader.wins} stage or one-day wins`;
      add("season", "season-leader", [
        [
          "season-leader-repeat",
          `Avant cette course, ${rider} comptait déjà ${winningRecord} cette saison. Qu’est-ce qui a bien fonctionné et que vous aimeriez retrouver ?`,
          `Before this race, ${rider} already had ${winningRecordEn} this season. What would you like to reproduce with him?`,
        ],
        [
          "season-leader-share",
          `${rider} avait déjà gagné cette saison avant cette épreuve. Sur quelle course comptez-vous lui donner une nouvelle occasion de gagner ?`,
          `${rider} had already won this season before today. Which race do you see as his next chance to win?`,
        ],
        [
          "season-leader-room-for-others",
          `${rider} a déjà gagné cette saison. Sur quel type de parcours donneriez-vous leur chance à d’autres coureurs de l’équipe ?`,
          `${rider} has already shown he can win this season. On what terrain would you give some of your other riders a chance as well?`,
        ],
      ]);
    }
  }

  const opponent = facts.opponent;
  if (opponent && opponent.teamId !== context.teamId) {
    const rivalRider = opponent.riderName;
    const rivalTeam = opponent.teamName;
    const result = `${rivalRider} termine ${formatOrdinal(opponent.rank)} pour ${rivalTeam}.`;
    const resultEn = `${rivalRider} finishes ${formatEnglishOrdinal(opponent.rank)} for ${rivalTeam}.`;
    add("opponent", "opponent-result", [
      [
        "opponent-reuse",
        `${result} Quel détail aimeriez-vous revoir pour comprendre ce qui lui a permis de signer ce résultat ?`,
        `${resultEn} What would you like to review to understand what helped him finish there?`,
      ],
      [
        "opponent-repeat-course",
        `${result} Si vous le retrouvez sur un parcours similaire, que feriez-vous différemment ?`,
        `${resultEn} If you faced him again on a similar course, what would you do differently?`,
      ],
      [
        "opponent-handicap",
        `${result} Sur quel type de parcours vos coureurs auraient-ils le plus de chances de le battre ?`,
        `${resultEn} What kind of course would give your riders the best chance of beating him?`,
      ],
      [
        "opponent-report",
        `Quel point fort de ${rivalRider} vous a le plus marqué aujourd’hui ?`,
        `What impressed you most about the way ${rivalRider} raced today?`,
      ],
      [
        "opponent-team-transfer",
        `${result} Quelle qualité chercheriez-vous chez un de vos coureurs pour rivaliser avec lui sur un parcours similaire ?`,
        `${resultEn} What quality would you look for in one of your own riders to challenge him on a similar course?`,
      ],
    ]);
    if (!context.stageType || context.stageType === "road") {
      add("opponent", "opponent-result", [
        [
          "opponent-follow",
          `${result} À quel moment auriez-vous conseillé à vos coureurs de se placer dans sa roue ?`,
          `${resultEn} When would you have told your riders to get on his wheel?`,
        ],
      ]);
    }
    if (opponent.rank === 1) {
      add("opponent", "opponent-winner", [
        [
          "opponent-winner-what-if",
          `${rivalRider} s’impose pour ${rivalTeam}. Si vous pouviez changer une seule de vos décisions, laquelle aurait eu le plus de chances de menacer sa victoire ?`,
          `${rivalRider} wins for ${rivalTeam}. If you could change one decision, which would have given you the best chance of challenging him?`,
        ],
        [
          "opponent-winner-anticipate",
          `${rivalRider} s’impose pour ${rivalTeam}. Quel passage de l’épreuve reverriez-vous pour comprendre où il a fait la différence ?`,
          `${rivalRider} takes the win for ${rivalTeam}. Which part of the event would you review to see where he made the difference?`,
        ],
        [
          "opponent-winner-own-strength",
          `${rivalRider} l’emporte. Quelle force de ${context.teamName} pourrait faire basculer la prochaine confrontation ?`,
          `${rivalRider} wins. What strength could swing the next encounter in favour of ${context.teamName}?`,
        ],
      ]);
    }
    const ownRank = opponent.ownRiderRank;
    if (ownRank && ownRank > opponent.rank) {
      const ownResult = `${rivalRider} (${rivalTeam}) est ${formatOrdinal(opponent.rank)} et ${context.riderName} ${formatOrdinal(ownRank)}.`;
      const ownResultEn = `${rivalRider} (${rivalTeam}) finished ${formatEnglishOrdinal(opponent.rank)} and ${context.riderName} ${formatEnglishOrdinal(ownRank)}.`;
      add("opponent", "opponent-comparison", [
        [
          "opponent-head-to-head",
          `${ownResult} Sur quel type de parcours votre coureur aurait-il le plus de chances de finir devant lui ?`,
          `${ownResultEn} What kind of course would give your rider the best chance of finishing ahead of him?`,
        ],
        [
          "opponent-next-matchup",
          `${ownResult} Quel atout de ${context.riderName} pourrait faire la différence lors de leur prochaine confrontation ?`,
          `${ownResultEn} What strength could give ${context.riderName} the edge when they meet again?`,
        ],
      ]);
      if (opponent.sameTimeAsOwn) {
        add("opponent", "opponent-close-finish", [
          [
            "opponent-same-time",
            `${ownResult} Ils sont classés dans le même temps. Qu’est-ce qui pourrait permettre à votre coureur de finir devant lui la prochaine fois ?`,
            `${ownResultEn} They were given the same time. What could help your rider finish ahead of him next time?`,
          ],
          [
            "opponent-same-time-detail",
            `${rivalRider} devance ${context.riderName} au classement avec le même temps officiel. Que retenez-vous de la performance de votre coureur dans un résultat aussi serré ?`,
            `${rivalRider} finishes ahead of ${context.riderName} on the same official time. What do you take from your rider’s performance in such a close result?`,
          ],
        ]);
      } else if (
        opponent.gapToOwnSeconds != null &&
        Number.isFinite(opponent.gapToOwnSeconds) &&
        opponent.gapToOwnSeconds > 0
      ) {
        const gap = formatTimeGap(opponent.gapToOwnSeconds, "fr-FR");
        const gapEn = formatTimeGap(opponent.gapToOwnSeconds, "en-GB");
        add("opponent", "opponent-gap", [
          [
            "opponent-gap",
            `${rivalRider} a devancé ${context.riderName} de ${gap}. À quel endroit du parcours chercheriez-vous d’abord à réduire cet écart ?`,
            `${rivalRider} was ${gapEn} faster than ${context.riderName}. Where on the course would you first look to close that gap?`,
          ],
          [
            "opponent-gap-prep",
            `${context.riderName} termine à ${gap} de ${rivalRider}. Que changeriez-vous dans sa préparation pour un parcours similaire ?`,
            `${context.riderName} was ${gapEn} behind the time set by ${rivalRider}. What would you change in the build-up to a similar event?`,
          ],
        ]);
      }
    }
    const otherTopTen = opponent.teammateFinishesInTopTen ?? 0;
    if (opponent.rank <= 10 && otherTopTen > 0) {
      const teamResult = `${rivalTeam} place ${otherTopTen + 1} coureurs dans les dix premiers, dont ${rivalRider} (${formatOrdinal(opponent.rank)}).`;
      const teamResultEn = `${rivalTeam} put ${otherTopTen + 1} riders in the top ten, including ${rivalRider} in ${formatEnglishOrdinal(opponent.rank)}.`;
      add("opponent", "opponent-team-depth", [
        [
          "opponent-collective",
          `${teamResult} Pour rivaliser avec cette équipe, miseriez-vous sur un seul leader ou sur plusieurs coureurs ?`,
          `${teamResultEn} To challenge them, would you back your strongest rider or give a few riders the freedom to try something?`,
        ],
        [
          "opponent-depth",
          `${teamResult} Qu’attendez-vous de vos coureurs pour rivaliser avec une équipe aussi bien placée ?`,
          `${teamResultEn} What would you want from your riders to take on a team with that kind of depth?`,
        ],
        [
          "opponent-multiple-threats",
          `${teamResult} Face à une équipe aussi présente au classement, comment décidez-vous quel coureur surveiller en priorité ?`,
          `${teamResultEn} When a team has that many riders near the top, how do you decide who to watch first?`,
        ],
      ]);
    }
  }

  return candidates;
}
