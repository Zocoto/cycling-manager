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
        "Si vous deviez donner une seule mission à votre cellule de recrutement, que lui demanderiez-vous d’observer en course, au-delà du classement ?",
        "If you could give your recruitment team one assignment, what would you ask them to watch for in races beyond the results?",
      ],
      [
        "transfer-future-swap-or-buy",
        "Si deux équipes étaient prêtes à discuter d’un même profil, qu’est-ce qui vous ferait préférer un échange à un achat ?",
        "If the same kind of rider were available from two teams, what would make you prefer a swap to a purchase?",
      ],
      [
        "transfer-future-promote",
        "Si une place se libérait dans l’effectif, sur quelle preuve en course préféreriez-vous miser sur un coureur du club plutôt que recruter ?",
        "If a spot opened up, what would you need to see in a race to back a rider already at the club over a new signing?",
      ],
      [
        "transfer-future-specialist-or-versatile",
        "Si votre prochain recrutement devait améliorer un seul aspect de l’équipe, chercheriez-vous un spécialiste d’un terrain ou un coureur capable de changer de rôle en course ?",
        "If your next signing could improve one part of the team, would you look for a specialist on a particular terrain or a rider who can switch jobs mid-race?",
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
          `${result} Sur les prochaines courses, quel indicateur vous aidera à savoir si cette performance peut se répéter ?`,
          `${resultEn} Over the next few races, what would tell you whether this is a performance you can repeat?`,
        ],
        [
          "season-next-block-calendar",
          `${result} Est-ce un résultat qui pourrait changer les courses que vous priorisez dans les semaines à venir ? Si oui, lesquelles ?`,
          `${resultEn} Could that result change which races you prioritise over the next few weeks? If so, which ones?`,
        ],
        [
          "season-next-block-rotation",
          `${result} Si vous deviez choisir dès maintenant vos prochains titulaires sur ce type de parcours, qu’est-ce qui pèserait le plus dans votre choix ?`,
          `${resultEn} If you had to pick your next lineup for this kind of course now, what would carry the most weight in your decision?`,
        ],
        [
          "season-next-block-test",
          `${result} Quelle consigne aimeriez-vous tester sur deux ou trois épreuves similaires avant d’en faire une habitude ?`,
          `${resultEn} What instruction would you try over two or three similar races before making it a regular part of your approach?`,
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
        `${joined} Quelle serait la première mission idéale pour lui, celle qui vous dirait que vous avez fait le bon choix ?`,
        `${joinedEn} What would be the ideal first assignment for him, the one that tells you you made the right call?`,
      ],
      [
        "arrival-hidden-criterion",
        `Quel détail de la candidature de ${rider} a pesé dans votre choix alors qu’il se voit à peine sur sa fiche ?`,
        `What about signing ${rider} mattered more to you than it might appear from his rider profile?`,
      ],
      [
        "arrival-change-of-plan",
        `Depuis l’arrivée de ${rider}, quel scénario de course osez-vous envisager que vous prépariez rarement jusque-là ?`,
        `Since ${rider} arrived, what race scenario are you more willing to prepare for now?`,
      ],
      [
        "arrival-room-to-grow",
        `Si ${rider} vous demande demain plus de liberté en course, sur quel profil lui diriez-vous oui ?`,
        `If ${rider} asked for more freedom to race tomorrow, on what kind of course would you give it to him?`,
      ],
      [
        "arrival-long-term",
        `À la fin de la saison, quel signe vous ferait dire que ${rider} s’est vraiment fait une place dans l’équipe ?`,
        `By the end of the season, what would show you that ${rider} had found his place on the team?`,
      ],
      [
        "arrival-roster-balance",
        `${joined} Son arrivée vous donne-t-elle surtout un nouveau leader, un soutien de plus ou une option que vous n’aviez pas ?`,
        `${joinedEn} Has his arrival given you a new leader, another support rider, or an option you were missing?`,
      ],
    ]);
    if (arrival.otherTeamName) {
      add("transfers", "transfers-arrival", [
        [
          "arrival-from-team",
          `${rider} arrive de ${arrival.otherTeamName}. Quelle habitude de course aimeriez-vous qu’il apporte avec lui ?`,
          `${rider} has joined from ${arrival.otherTeamName}. What racing habit would you like him to bring over?`,
        ],
        [
          "arrival-new-role",
          `Après son passage chez ${arrival.otherTeamName}, qu’est-ce qui pourrait faire changer ${rider} de dimension chez vous ?`,
          `After his time at ${arrival.otherTeamName}, what could help ${rider} take the next step with you?`,
        ],
        [
          "arrival-opposite-cars",
          `Quand ${rider} recroisera les maillots de ${arrival.otherTeamName} dans le peloton, quelle consigne aimeriez-vous lui donner ?`,
          `When ${rider} sees the ${arrival.otherTeamName} jerseys in the peloton again, what instruction would you give him?`,
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
        `${left} Quel rôle sera le plus difficile à redistribuer parmi vos coureurs ?`,
        `${leftEn} What part of his role will be hardest to share among your riders?`,
      ],
      [
        "departure-promote-internally",
        `Le départ de ${rider} libère une place dans le groupe. Préférez-vous donner sa chance à un coureur déjà là ou rouvrir le dossier du recrutement ?`,
        `With ${rider} leaving, a spot has opened up. Would you give someone already in the team a chance or go back to the transfer market?`,
      ],
      [
        "departure-decision-in-hindsight",
        `Avec le recul, quel élément du dossier ${rider} regarderiez-vous plus tôt la prochaine fois que vous devrez décider d’un départ ?`,
        `Looking back on the departure of ${rider}, what would you look at earlier next time you have a decision like this to make?`,
      ],
      [
        "departure-slot-in-calendar",
        `${left} Y a-t-il un rendez-vous de la saison que vous préparerez différemment depuis son départ ?`,
        `${leftEn} Is there a race this season you’ll prepare for differently now that he’s gone?`,
      ],
      [
        "departure-rebuild-different",
        `S’il fallait réinvestir la place laissée libre par ${rider}, chercheriez-vous un profil semblable ou un coureur qui change la façon de courir de l’équipe ?`,
        `When filling the spot ${rider} left, would you look for a similar rider or someone who changes how the team races?`,
      ],
    ]);
    if (departure.otherTeamName) {
      add("transfers", "transfers-departure", [
        [
          "departure-face-former-rider",
          `Vous pourriez retrouver ${rider} sous les couleurs de ${departure.otherTeamName}. Dans quel scénario serait-il le plus gênant à avoir en face ?`,
          `You could see ${rider} again in ${departure.otherTeamName} colours. In which race situation would he be hardest to face?`,
        ],
        [
          "departure-opponent-advantage",
          `Avec l’arrivée de ${rider}, sur quel type de course regarderiez-vous d’un autre œil la composition de ${departure.otherTeamName} ?`,
          `Now that ${rider} rides for ${departure.otherTeamName}, on what kind of course would you look at their lineup differently?`,
        ],
        [
          "departure-former-team-knowledge",
          `${rider} est parti chez ${departure.otherTeamName}. Quand vous le recroiserez en course, qu’est-ce qui restera difficile à anticiper chez lui malgré le temps passé ensemble ?`,
          `${rider} has moved to ${departure.otherTeamName}. What would still be hard to predict about him when you race against him again?`,
        ],
      ]);
    }
    if (departure.isSale) {
      add("transfers", "transfers-sale", [
        [
          "sale-value",
          `Après la vente de ${rider}, si vous recrutiez de nouveau, quelle qualité chercheriez-vous en priorité ?`,
          `After selling ${rider}, if you went back to the market, what quality would you look for first?`,
        ],
        [
          "sale-reinvest",
          `Après la vente de ${rider}, qu’est-ce qui justifierait de réinvestir vite, et qu’est-ce qui vous ferait attendre ?`,
          `After selling ${rider}, what would make you reinvest quickly and what would make you wait?`,
        ],
        [
          "sale-sporting-impact",
          `La vente de ${rider} est actée. Quel rôle en course risque de vous manquer plus que prévu ?`,
          `The sale of ${rider} is complete. Which racing role might you miss more than you expected?`,
        ],
      ]);
    }
  }

  if (arrival && departure && arrival.riderName !== departure.riderName) {
    add("transfers", "transfers-market", [
      [
        "transfer-roster-difference",
        `Entre le départ de ${departure.riderName} et l’arrivée de ${arrival.riderName}, sur quel profil de course verrait-on le mieux ce qui a changé dans l’effectif ?`,
        `With ${departure.riderName} leaving and ${arrival.riderName} coming in, what type of course would best show how the team has changed?`,
      ],
      [
        "transfer-market-tradeoff",
        `${departure.riderName} est parti et ${arrival.riderName} a rejoint le groupe. Quel compromis est devenu le plus difficile quand vous composez une équipe de course ?`,
        `${departure.riderName} has left and ${arrival.riderName} has arrived. What’s the toughest trade-off when you pick a race lineup now?`,
      ],
      [
        "transfer-changing-identity",
        `Si on ne regardait que le départ de ${departure.riderName} et l’arrivée de ${arrival.riderName}, quelle idée de votre projet sportif en aurait-on ?`,
        `If people only saw ${departure.riderName} leave and ${arrival.riderName} arrive, what impression would they get of your plans for the team?`,
      ],
    ]);
  }

  const leader = facts.seasonLeader;
  if (leader && leader.daysRaced >= 5) {
    const rider = leader.riderName;
    const noWins = `Avant cette épreuve, ${rider} avait couru ${leader.daysRaced} jours en individuel cette saison, sans victoire d’étape ni de classique.`;
    const noWinsEn = `Before this race, ${rider} had ${leader.daysRaced} days of individual racing this season without winning a stage or a one-day race.`;

    if (leader.wins === 0) {
      add("season", "season-leader", [
        [
          "season-leader-calendar",
          `${noWins} Quelle course choisiriez-vous pour lui donner une vraie occasion de débloquer le compteur ?`,
          `${noWinsEn} Which race would offer him the best chance of getting that first win?`,
        ],
        [
          "season-leader-plan-b",
          `${noWins} À quel moment ouvrez-vous le jeu à un deuxième leader ?`,
          `${noWinsEn} At what point would you look at giving a second rider a leadership role?`,
        ],
        [
          "season-leader-small-signal",
          `${noWins} Quel progrès observable en course vous convaincrait de maintenir le cap avec lui ?`,
          `${noWinsEn} What sign of improvement in a race would convince you to stay the course with him?`,
        ],
        [
          "season-leader-support",
          `${noWins} Qu’attendez-vous de ses équipiers pour l’aider à convertir une bonne journée en résultat ?`,
          `${noWinsEn} What do you want his teammates to do to help him turn a good day into a result?`,
        ],
        [
          "season-leader-trust",
          `${noWins} Si vous deviez choisir un point à travailler avec lui dès demain pour changer ce bilan, lequel choisiriez-vous ?`,
          `${noWinsEn} What would you focus on with him tomorrow to try to change that record?`,
        ],
        [
          "season-leader-opportunity",
          `${noWins} Pour changer la donne, joueriez-vous une course loin de ses habitudes ou renforceriez-vous le soutien sur son terrain préféré ?`,
          `${noWinsEn} Would you give him a chance on unfamiliar terrain or strengthen the support on courses that suit him best?`,
        ],
      ]);
      if (leader.topTenFinishes === 0) {
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
            `Avant cette épreuve, ${rider} comptait ${leader.topTenFinishes} top 10 en individuel et aucune victoire d’étape ou de classique cette saison. Que lui manque-t-il pour peser sur les derniers kilomètres ?`,
            `Before this race, ${rider} had ${leader.topTenFinishes} individual top-ten finishes but no stage or one-day win this season. What’s missing for him in the final kilometres?`,
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
    } else {
      const winningRecord = leader.wins === 1
        ? "une victoire d’étape ou de classique"
        : `${leader.wins} victoires d’étape ou de classique`;
      const winningRecordEn = leader.wins === 1
        ? "one stage or one-day win"
        : `${leader.wins} stage or one-day wins`;
      add("season", "season-leader", [
        [
          "season-leader-repeat",
          `Avant cette course, ${rider} comptait déjà ${winningRecord} cette saison. Quelle recette aimeriez-vous reproduire avec lui ?`,
          `Before this race, ${rider} already had ${winningRecordEn} this season. What would you like to reproduce with him?`,
        ],
        [
          "season-leader-share",
          `${rider} avait déjà gagné cette saison avant cette épreuve. Comment décider du prochain rendez-vous où l’équipe roulera pour lui ?`,
          `${rider} had already won this season before today. How will you pick the next race where the team rides for him?`,
        ],
        [
          "season-leader-room-for-others",
          `${rider} a déjà prouvé qu’il pouvait gagner cette saison. Sur quel terrain donneriez-vous aussi leur chance à d’autres coureurs ?`,
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
        `${result} Si vous deviez le retrouver ici demain, quel scénario voudriez-vous éviter ?`,
        `${resultEn} If you faced him here again tomorrow, what race scenario would you want to avoid?`,
      ],
      [
        "opponent-handicap",
        `${result} Quel terrain permettrait à vos coureurs de le mettre le plus en difficulté ?`,
        `${resultEn} What terrain would give your riders the best chance of putting him under pressure?`,
      ],
      [
        "opponent-report",
        `Si vous deviez remettre une note à votre staff sur ${rivalRider} après cette ${context.stageType === "road" ? "course" : "épreuve"}, quel serait le premier point à retenir ?`,
        `If you had to brief your staff on ${rivalRider} after this event, what would be the first thing you’d highlight?`,
      ],
      [
        "opponent-team-transfer",
        `${result} Que vous apprend ce résultat sur le type de coureur que vous aimeriez pouvoir aligner face à eux ?`,
        `${resultEn} What does that tell you about the kind of rider you’d want to field against them?`,
      ],
    ]);
    if (!context.stageType || context.stageType === "road") {
      add("opponent", "opponent-result", [
        [
          "opponent-follow",
          `${result} À l’avenir, quel indice vous ferait dire qu’il est temps de prendre sa roue ?`,
          `${resultEn} Next time, what sign would tell you it was time to get on his wheel?`,
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
          `${rivalTeam} repart avec la victoire de ${rivalRider}. Quel passage de l’épreuve reverriez-vous pour mieux comprendre comment leur répondre ?`,
          `${rivalRider} takes the win for ${rivalTeam}. Which part of the event would you review to work out how to respond?`,
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
          `${ownResult} Dans quel registre votre coureur aurait-il le plus de chances d’inverser cet ordre ?`,
          `${ownResultEn} On what terrain would your rider have the best chance of reversing that order?`,
        ],
        [
          "opponent-next-matchup",
          `${ownResult} Sur quel élément concret départageriez-vous les deux avant de les retrouver sur une épreuve similaire ?`,
          `${ownResultEn} What would you look at to decide which of them has the edge before a similar event?`,
        ],
      ]);
      if (opponent.sameTimeAsOwn) {
        add("opponent", "opponent-close-finish", [
          [
            "opponent-same-time",
            `${ownResult} Le classement officiel leur donne le même temps. Qu’aimeriez-vous changer pour que votre coureur franchisse la ligne devant lui la prochaine fois ?`,
            `${ownResultEn} They were given the same official time. What would you change so your rider crosses the line ahead next time?`,
          ],
          [
            "opponent-same-time-detail",
            `${rivalRider} devance ${context.riderName} au classement avec le même temps officiel. Quel détail peut faire gagner une place dans ce genre d’arrivée ?`,
            `${rivalRider} finishes ahead of ${context.riderName} on the same official time. What small detail could win your rider a place at a finish like that?`,
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
            `Il manque ${gap} à ${context.riderName} pour rejoindre le temps de ${rivalRider}. Quelle préparation changeriez-vous avant une épreuve de ce profil ?`,
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
          `${teamResult} Pour leur répondre, miseriez-vous sur le meilleur de vos coureurs ou sur plusieurs cartes à jouer ?`,
          `${teamResultEn} To challenge them, would you back your strongest rider or give a few riders the freedom to try something?`,
        ],
        [
          "opponent-depth",
          `${teamResult} Quelle qualité voudriez-vous voir chez vos équipiers pour concurrencer une équipe capable de placer autant de monde ?`,
          `${teamResultEn} What would you want from your support riders to take on a team with that kind of depth?`,
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
