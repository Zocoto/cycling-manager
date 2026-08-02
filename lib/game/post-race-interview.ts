export type PostRaceInterviewQuestionCategory =
  | "result"
  | "tactics"
  | "outlook"
  | "rivalry";

export type PostRaceInterviewQuestion = {
  id: string;
  category: PostRaceInterviewQuestionCategory;
  text: string;
  subjectTeamId?: string;
  sourceInterviewId?: string;
};

export type PostRaceInterviewRivalryContext =
  | {
      kind: "opinion";
      teamId: string;
      teamName: string;
      directorName: string;
      riderName: string;
      achievement: "winner" | "runner_up";
    }
  | {
      kind: "rebound";
      teamId: string;
      teamName: string;
      directorName: string;
      quote: string;
      sourceInterviewId: string;
    };

export type PostRaceInterviewAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

export type PostRaceInterviewContext = {
  raceName: string;
  stageName: string;
  teamId: string;
  teamName: string;
  directorName: string;
  directorAvatarKey: string | null;
  riderName: string;
  bestRank: number | null;
  gapLabel: string | null;
  uciRank: number | null;
  divisionLabel: string | null;
  tookBreakaway: boolean;
  tookChase: boolean;
  rivalry?: PostRaceInterviewRivalryContext | null;
};

export type PostRaceInterviewSnapshot = {
  id: string;
  status: "pending" | "submitted";
  questions: PostRaceInterviewQuestion[];
  answers: PostRaceInterviewAnswer[];
  closingNote: string;
  context: PostRaceInterviewContext;
  submittedAt: string | null;
};

type QuestionDefinition = {
  id: string;
  category: PostRaceInterviewQuestionCategory;
  situations?: Array<"win" | "podium" | "top10" | "outside">;
  requires?:
    | "breakaway"
    | "chase"
    | "uci"
    | "rival_opinion"
    | "rival_quote";
  text: string;
};

export const POST_RACE_INTERVIEW_QUESTION_POOL: readonly QuestionDefinition[] = [
  { id: "win-significance", category: "result", situations: ["win"], text: "Que représente cette victoire de {{riderName}} pour {{teamName}} ?" },
  { id: "win-belief", category: "result", situations: ["win"], text: "À quel moment avez-vous compris que {{riderName}} pouvait gagner aujourd’hui ?" },
  { id: "win-plan", category: "result", situations: ["win"], text: "Votre plan semble avoir été exécuté à la perfection. La course s’est-elle vraiment déroulée comme prévu ?" },
  { id: "win-final-message", category: "result", situations: ["win"], text: "Qu’avez-vous dit à {{riderName}} dans les derniers kilomètres ?" },
  { id: "win-collective", category: "result", situations: ["win"], text: "Cette victoire doit-elle davantage au talent de {{riderName}} ou au travail collectif ?" },
  { id: "win-season", category: "result", situations: ["win"], text: "Est-ce votre plus belle victoire de la saison jusqu’ici ?" },
  { id: "podium-feeling", category: "result", situations: ["podium"], text: "Ce podium vous laisse-t-il davantage de satisfaction ou de frustration ?" },
  { id: "podium-ambition", category: "result", situations: ["podium"], text: "Étiez-vous venus sur {{raceName}} avec l’ambition de monter sur le podium ?" },
  { id: "podium-gap", category: "result", situations: ["podium"], text: "Votre meilleur coureur termine {{gapLabel}} du vainqueur. Où la course s’est-elle décidée selon vous ?" },
  { id: "podium-collective", category: "result", situations: ["podium"], text: "L’équipe a-t-elle suffisamment entouré {{riderName}} dans le final ?" },
  { id: "podium-next-step", category: "result", situations: ["podium"], text: "Ce résultat confirme-t-il que {{riderName}} peut bientôt franchir le cap de la victoire ?" },
  { id: "top10-balance", category: "result", situations: ["top10"], text: "Ce top 10 est-il un résultat satisfaisant ou pensez-vous que l’équipe pouvait viser plus haut ?" },
  { id: "top10-support", category: "result", situations: ["top10"], text: "Qu’a-t-il manqué à vos coureurs pour accompagner les meilleurs jusqu’au bout ?" },
  { id: "top10-progression", category: "result", situations: ["top10"], text: "Voyez-vous dans ce résultat une vraie progression de l’équipe ?" },
  { id: "top10-signals", category: "result", situations: ["top10"], text: "Malgré l’absence de podium, quels signaux positifs retenez-vous de cette journée ?" },
  { id: "outside-explain", category: "result", situations: ["outside"], text: "Aucun de vos coureurs ne termine dans le top 10. Comment l’expliquez-vous ?" },
  { id: "outside-influence", category: "result", situations: ["outside"], text: "Votre équipe n’a jamais réellement pesé sur la course. Est-ce une déception ?" },
  { id: "outside-cause", category: "result", situations: ["outside"], text: "Cette contre-performance est-elle physique, tactique ou collective ?" },
  { id: "outside-opportunity", category: "result", situations: ["outside"], text: "Le profil de {{raceName}} semblait pourtant vous convenir. Avez-vous manqué une occasion ?" },
  { id: "outside-rebuild", category: "result", situations: ["outside"], text: "Comment comptez-vous remobiliser vos coureurs après ce résultat ?" },
  { id: "tactics-breakaway", category: "tactics", requires: "breakaway", text: "La présence d’un de vos coureurs dans l’échappée faisait-elle partie du plan ou était-ce une opportunité de course ?" },
  { id: "tactics-leader", category: "tactics", text: "L’équipe a longtemps roulé pour son leader. Était-ce pour contrôler la course ou provoquer une sélection ?" },
  { id: "tactics-hindsight", category: "tactics", text: "Avec le recul, changeriez-vous quelque chose à votre stratégie sur {{stageName}} ?" },
  { id: "tactics-chase", category: "tactics", requires: "chase", text: "Le peloton a laissé partir un groupe dangereux. Avez-vous hésité à organiser la poursuite plus tôt ?" },
  { id: "tactics-isolated", category: "tactics", text: "Votre leader s’est retrouvé isolé dans le final. Était-ce prévu ou avez-vous perdu des équipiers trop tôt ?" },
  { id: "outlook-mood", category: "outlook", text: "Quel est l’état d’esprit du groupe après l’arrivée ?" },
  { id: "outlook-character", category: "outlook", text: "Votre équipe a-t-elle montré le caractère que vous attendiez aujourd’hui ?" },
  { id: "outlook-uci-gap", category: "outlook", requires: "uci", text: "Vous occupez actuellement la {{uciRank}}e place au classement UCI. Que vous manque-t-il pour progresser ?" },
  { id: "outlook-elite", category: "outlook", text: "La montée en Élite est-elle un objectif réaliste pour {{teamName}} cette saison ?" },
  { id: "outlook-program", category: "outlook", text: "Cette performance va-t-elle modifier vos ambitions ou le programme de l’équipe pour la suite ?" },
  { id: "rivalry-winner-team", category: "rivalry", requires: "rival_opinion", text: "{{rivalRiderName}} s’est imposé avec {{rivalTeamName}}. Quel regard portez-vous sur cette équipe et le travail de {{rivalDirectorName}} ?" },
  { id: "rivalry-director-mentality", category: "rivalry", requires: "rival_opinion", text: "Que pensez-vous de la mentalité insufflée par {{rivalDirectorName}} à {{rivalTeamName}} ?" },
  { id: "rivalry-respect", category: "rivalry", requires: "rival_opinion", text: "Entre {{teamName}} et {{rivalTeamName}}, parle-t-on de rivalité, de respect ou un peu des deux ?" },
  { id: "rivalry-tactics", category: "rivalry", requires: "rival_opinion", text: "Comment jugez-vous les choix tactiques de {{rivalDirectorName}} aujourd’hui ?" },
  { id: "rivalry-future", category: "rivalry", requires: "rival_opinion", text: "{{rivalTeamName}} vous semble-t-elle être l’une des équipes à suivre pour la suite de la saison ?" },
  { id: "rivalry-message", category: "rivalry", requires: "rival_opinion", text: "Quel message adresseriez-vous à {{rivalDirectorName}} après cette course ?" },
  { id: "rebound-direct", category: "rivalry", requires: "rival_quote", text: "{{rivalDirectorName}} a déclaré à votre sujet : « {{rivalQuote}} ». Qu’avez-vous à lui répondre ?" },
  { id: "rebound-surprised", category: "rivalry", requires: "rival_quote", text: "Les propos de {{rivalDirectorName}} — « {{rivalQuote}} » — vous surprennent-ils ?" },
  { id: "rebound-rivalry", category: "rivalry", requires: "rival_quote", text: "Après ces mots de {{rivalDirectorName}} — « {{rivalQuote}} » — la rivalité entre {{teamName}} et {{rivalTeamName}} change-t-elle de dimension ?" },
  { id: "rebound-clarify", category: "rivalry", requires: "rival_quote", text: "{{rivalDirectorName}} affirme : « {{rivalQuote}} ». Souhaitez-vous rectifier ou nuancer ses propos ?" },
  { id: "rebound-pressure", category: "rivalry", requires: "rival_quote", text: "La sortie de {{rivalDirectorName}} — « {{rivalQuote}} » — ajoute-t-elle une pression particulière sur votre groupe ?" },
  { id: "rebound-next-race", category: "rivalry", requires: "rival_quote", text: "« {{rivalQuote}} » : ces propos de {{rivalDirectorName}} auront-ils une influence lors de votre prochaine confrontation ?" },
];

export function selectPostRaceInterviewQuestions(
  context: PostRaceInterviewContext,
  seed: string,
): PostRaceInterviewQuestion[] {
  const situation = getResultSituation(context.bestRank);
  const resultQuestions = eligibleQuestions(context).filter(
    (question) =>
      question.category === "result" &&
      question.situations?.includes(situation),
  );
  const tacticalQuestions = eligibleQuestions(context).filter(
    (question) => question.category === "tactics",
  );
  const outlookQuestions = eligibleQuestions(context).filter(
    (question) => question.category === "outlook",
  );
  const rivalryQuestions = eligibleQuestions(context).filter(
    (question) => question.category === "rivalry",
  );
  const closingQuestions =
    rivalryQuestions.length > 0 ? rivalryQuestions : outlookQuestions;

  return [resultQuestions, tacticalQuestions, closingQuestions].map(
    (questions, index) => {
      const question = questions[seededIndex(`${seed}:${index}`, questions.length)];
      const selected: PostRaceInterviewQuestion = {
        id: question.id,
        category: question.category,
        text: renderQuestion(question.text, context),
      };
      if (question.category === "rivalry" && context.rivalry) {
        selected.subjectTeamId = context.rivalry.teamId;
        if (context.rivalry.kind === "rebound") {
          selected.sourceInterviewId = context.rivalry.sourceInterviewId;
        }
      }
      return selected;
    },
  );
}

function eligibleQuestions(context: PostRaceInterviewContext) {
  return POST_RACE_INTERVIEW_QUESTION_POOL.filter((question) => {
    if (question.requires === "breakaway") return context.tookBreakaway;
    if (question.requires === "chase") return context.tookChase;
    if (question.requires === "uci") return context.uciRank !== null;
    if (question.requires === "rival_opinion") {
      return context.rivalry?.kind === "opinion";
    }
    if (question.requires === "rival_quote") {
      return context.rivalry?.kind === "rebound";
    }
    return true;
  });
}

function getResultSituation(bestRank: number | null) {
  if (bestRank === 1) return "win" as const;
  if (bestRank !== null && bestRank <= 3) return "podium" as const;
  if (bestRank !== null && bestRank <= 10) return "top10" as const;
  return "outside" as const;
}

function renderQuestion(template: string, context: PostRaceInterviewContext) {
  const values: Record<string, string> = {
    raceName: context.raceName,
    stageName: context.stageName,
    teamName: context.teamName,
    riderName: context.riderName,
    gapLabel: context.gapLabel ?? "à quelques secondes",
    uciRank: String(context.uciRank ?? "—"),
    rivalTeamName: context.rivalry?.teamName ?? "l’équipe rivale",
    rivalDirectorName: context.rivalry?.directorName ?? "le DS adverse",
    rivalRiderName:
      context.rivalry?.kind === "opinion" ? context.rivalry.riderName : "Le vainqueur",
    rivalQuote: context.rivalry?.kind === "rebound" ? context.rivalry.quote : "",
  };

  return template.replace(/{{(\w+)}}/g, (_match, key: string) => values[key] ?? "");
}

function seededIndex(seed: string, length: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, length);
}
