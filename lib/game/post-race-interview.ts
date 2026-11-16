import {
  buildPostRaceEditorialQuestions,
  type PostRaceInterviewEditorialFacts,
} from "./post-race-interview-editorial";
import type { RiderPersonalityKey } from "./rider-personalities";
import {
  buildDetailedRaceInterviewQuestions,
  TEAM_TIME_TRIAL_INTERVIEW_FALLBACK,
  type PostRaceInterviewDetailedRaceFacts,
} from "./post-race-interview-race-questions";

export type PostRaceInterviewQuestionCategory =
  "result" | "tactics" | "race_fact" | "outlook" | "rivalry" | "event" | "season" | "transfers" | "opponent";

export type ZoneMixteEventRarity = "common" | "notable" | "rare";
export type ZoneMixteEventRisk = "safe" | "balanced" | "bold";

export type ZoneMixteEventOutcome = {
  weight: number;
  reputationDelta?: number;
  cashDelta?: number;
  riderPopularityDelta?: number;
  riderMoraleDelta?: number;
  inventoryItemKey?: "acceleration-focus";
  inventoryItemName?: "Module explosivité";
  summary: string;
};

export type ZoneMixteEventChoice = {
  id: string;
  label: string;
  description: string;
  impactPreview: string;
  risk: ZoneMixteEventRisk;
  outcomes: ZoneMixteEventOutcome[];
};

export type ZoneMixteEvent = {
  id: string;
  riderId?: string;
  rarity: ZoneMixteEventRarity;
  title: string;
  story: string;
  choices: ZoneMixteEventChoice[];
};

export type PostRaceInterviewQuestion = {
  id: string;
  category: PostRaceInterviewQuestionCategory;
  text: string;
  textEn?: string;
  topic?: string;
  subjectTeamId?: string;
  sourceInterviewId?: string;
};

export type PostRaceInterviewRivalryContext =
  | {
      kind: "season_rivalry";
      teamId: string;
      teamName: string;
      directorName: string;
      riderName: string;
      rivalRank: number;
      ownScore: number;
      rivalScore: number;
      pairingReason: string;
    }
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

export type PostRaceInterviewRaceFacts = {
  breakawayOccurred: boolean;
  crashOccurred: boolean;
  crosswindOccurred: boolean;
};

export type PostRaceInterviewAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

export type PostRaceInterviewContext = {
  questionVersion?: number;
  raceName: string;
  stageName: string;
  stageType?: "road" | "individual_time_trial" | "team_time_trial" | "prologue";
  weatherLabel?: string | null;
  teamId: string;
  teamName: string;
  directorName: string;
  directorAvatarKey: string | null;
  riderName: string;
  riderId?: string | null;
  riderPersonalityKey?: RiderPersonalityKey | null;
  riderHadSetback?: boolean;
  wasTeamLeader?: boolean;
  sponsorName?: string | null;
  raceCountryCode?: string | null;
  bestRank: number | null;
  gapLabel: string | null;
  uciRank: number | null;
  divisionLabel: string | null;
  uciLeaderName?: string | null;
  uciLeaderTeamName?: string | null;
  tookBreakaway: boolean;
  tookChase: boolean;
  raceFacts?: PostRaceInterviewRaceFacts;
  detailedRaceFacts?: PostRaceInterviewDetailedRaceFacts;
  editorialFacts?: PostRaceInterviewEditorialFacts;
  rivalry?: PostRaceInterviewRivalryContext | null;
  zoneMixteEvent?: ZoneMixteEvent | null;
};

export type PostRaceInterviewEventResolution = {
  choiceId: string;
  choiceLabel: string;
  outcome: ZoneMixteEventOutcome;
};

export type PostRaceInterviewSnapshot = {
  id: string;
  status: "pending" | "submitted" | "closed";
  questions: PostRaceInterviewQuestion[];
  answers: PostRaceInterviewAnswer[];
  closingNote: string;
  context: PostRaceInterviewContext;
  submittedAt: string | null;
  eventResolution: PostRaceInterviewEventResolution | null;
};

export type PostRaceInterviewSubmissionResult =
  | { ok: true; interview: PostRaceInterviewSnapshot }
  | { ok: false; message: string };

export function concealZoneMixteEventOutcomes(
  context: PostRaceInterviewContext,
): PostRaceInterviewContext {
  const event = context.zoneMixteEvent;
  if (!event) return context;

  return {
    ...context,
    zoneMixteEvent: {
      ...event,
      choices: event.choices.map((choice) => ({
        ...choice,
        impactPreview: "Conséquence cachée",
        outcomes: [],
      })),
    },
  };
}

type ResultSituation = "win" | "podium" | "top10" | "outside";
type InterviewRaceType = "road" | "itt";
type QuestionRequirement =
  | "breakaway"
  | "race_breakaway"
  | "chase"
  | "crash"
  | "crosswind"
  | "weather"
  | "uci"
  | "uci_leader"
  | "rival_winner"
  | "rival_runner_up"
  | "rival_quote"
  | "season_rivalry";

type QuestionDefinition = {
  id: string;
  category: PostRaceInterviewQuestionCategory;
  situations?: ResultSituation[];
  raceTypes?: InterviewRaceType[];
  requires?: QuestionRequirement;
  text: string;
};

export const POST_RACE_INTERVIEW_QUESTION_POOL: readonly QuestionDefinition[] =
  [
    // Résultat · courses en ligne
    {
      id: "win-significance",
      category: "result",
      situations: ["win"],
      text: "Que représente cette victoire de {{riderName}} pour {{teamName}} ?",
    },
    {
      id: "win-belief",
      category: "result",
      situations: ["win"],
      text: "À quel moment avez-vous compris que {{riderName}} pouvait gagner aujourd’hui ?",
    },
    {
      id: "win-plan",
      category: "result",
      situations: ["win"],
      text: "La course s’est-elle déroulée comme vous l’aviez prévu ? Qu’est-ce qui a fait la différence ?",
    },
    {
      id: "win-final-message",
      category: "result",
      situations: ["win"],
      text: "Quelle consigne avez-vous donnée à {{riderName}} pour le final ?",
    },
    {
      id: "win-collective",
      category: "result",
      situations: ["win"],
      text: "Cette victoire doit-elle davantage au talent de {{riderName}} ou au travail collectif ?",
    },
    {
      id: "win-season",
      category: "result",
      situations: ["win"],
      text: "Est-ce votre plus belle victoire de la saison jusqu’ici ?",
    },
    {
      id: "win-turning-point",
      category: "result",
      situations: ["win"],
      text: "Quel a été, selon vous, le véritable tournant de cette victoire ?",
    },
    {
      id: "win-pressure",
      category: "result",
      situations: ["win"],
      text: "Comment l’équipe a-t-elle géré la pression lorsque la victoire est devenue possible ?",
    },
    {
      id: "win-risk",
      category: "result",
      situations: ["win"],
      text: "Y a-t-il une décision risquée qui a payé aujourd’hui ?",
    },
    {
      id: "win-symbol",
      category: "result",
      situations: ["win"],
      text: "Quelle force de {{teamName}} cette victoire a-t-elle mise en valeur ?",
    },
    {
      id: "podium-feeling",
      category: "result",
      situations: ["podium"],
      text: "Ce podium vous laisse-t-il davantage de satisfaction ou de frustration ?",
    },
    {
      id: "podium-ambition",
      category: "result",
      situations: ["podium"],
      text: "Visiez-vous un podium avant le départ ?",
    },
    {
      id: "podium-gap",
      category: "result",
      situations: ["podium"],
      text: "Votre meilleur coureur termine {{gapLabel}} du vainqueur. Où la course s’est-elle décidée selon vous ?",
    },
    {
      id: "podium-collective",
      category: "result",
      situations: ["podium"],
      text: "L’équipe a-t-elle suffisamment entouré {{riderName}} dans le final ?",
    },
    {
      id: "podium-next-step",
      category: "result",
      situations: ["podium"],
      text: "Que manque-t-il à {{riderName}} pour transformer ce podium en victoire ?",
    },
    {
      id: "podium-regret",
      category: "result",
      situations: ["podium"],
      text: "Qu’est-ce qui vous a le plus plu dans ce podium ? Y a-t-il encore un regret ?",
    },
    {
      id: "podium-reference",
      category: "result",
      situations: ["podium"],
      text: "Ce podium constitue-t-il désormais une référence pour votre groupe ?",
    },
    {
      id: "podium-boldness",
      category: "result",
      situations: ["podium"],
      text: "Auriez-vous préféré voir l’équipe courir avec davantage d’audace, quitte à perdre ce podium ?",
    },
    {
      id: "top10-balance",
      category: "result",
      situations: ["top10"],
      text: "Ce top 10 est-il un résultat satisfaisant ou pensez-vous que l’équipe pouvait viser plus haut ?",
    },
    {
      id: "top10-support",
      category: "result",
      situations: ["top10"],
      text: "Qu’est-ce qui aurait permis à {{riderName}} de gagner quelques places ?",
    },
    {
      id: "top10-progression",
      category: "result",
      situations: ["top10"],
      text: "Voyez-vous dans ce résultat une vraie progression de l’équipe ?",
    },
    {
      id: "top10-signals",
      category: "result",
      situations: ["top10"],
      text: "Que retenez-vous de positif dans ce top 10 ?",
    },
    {
      id: "top10-ceiling",
      category: "result",
      situations: ["top10"],
      text: "Ce top 10 correspond-il à ce que vous attendiez de l’équipe aujourd’hui ?",
    },
    {
      id: "top10-aggression",
      category: "result",
      situations: ["top10"],
      text: "Avec le recul, quelle initiative aurait pu vous rapprocher du podium ?",
    },
    {
      id: "top10-rider-role",
      category: "result",
      situations: ["top10"],
      text: "La place de {{riderName}} correspond-elle au rôle que vous lui aviez confié au départ ?",
    },
    {
      id: "top10-lesson",
      category: "result",
      situations: ["top10"],
      text: "Quelle leçon concrète l’équipe doit-elle tirer de ce top 10 ?",
    },
    {
      id: "outside-explain",
      category: "result",
      situations: ["outside"],
      text: "Aucun de vos coureurs ne termine dans le top 10. Comment l’expliquez-vous ?",
    },
    {
      id: "outside-influence",
      category: "result",
      situations: ["outside"],
      text: "Qu’est-ce qui a le mieux fonctionné dans la façon de courir de votre équipe ?",
    },
    {
      id: "outside-cause",
      category: "result",
      situations: ["outside"],
      text: "Qu’est-ce qui a le plus pesé sur votre résultat aujourd’hui ?",
    },
    {
      id: "outside-opportunity",
      category: "result",
      situations: ["outside"],
      text: "Quelles parties du parcours convenaient le mieux à vos coureurs ?",
    },
    {
      id: "outside-rebuild",
      category: "result",
      situations: ["outside"],
      text: "Comment comptez-vous remobiliser vos coureurs après ce résultat ?",
    },
    {
      id: "outside-hidden-positive",
      category: "result",
      situations: ["outside"],
      text: "Qu’est-ce qui a bien fonctionné malgré le résultat ?",
    },
    {
      id: "outside-expectations",
      category: "result",
      situations: ["outside"],
      text: "Quel résultat visiez-vous au départ, et comment jugez-vous la course au regard de cet objectif ?",
    },
    {
      id: "outside-responsibility",
      category: "result",
      situations: ["outside"],
      text: "Y a-t-il une décision que vous prendriez autrement après cette course ?",
    },
    {
      id: "outside-response",
      category: "result",
      situations: ["outside"],
      text: "Sur quoi comptez-vous travailler avec vos coureurs avant leur prochaine course ?",
    },

    // Résultat · CLM individuel
    {
      id: "clm-win-pacing",
      category: "result",
      situations: ["win"],
      raceTypes: ["itt"],
      text: "{{riderName}} remporte ce chrono : sa gestion de l’effort a-t-elle fait la différence ?",
    },
    {
      id: "clm-win-reference",
      category: "result",
      situations: ["win"],
      raceTypes: ["itt"],
      text: "Qu’a particulièrement bien réussi {{riderName}} dans ce contre-la-montre ?",
    },
    {
      id: "clm-podium-splits",
      category: "result",
      situations: ["podium"],
      raceTypes: ["itt"],
      text: "{{riderName}} termine sur le podium, {{gapLabel}} du meilleur temps. Où pensez-vous qu’il pouvait gagner du temps ?",
    },
    {
      id: "clm-podium-satisfaction",
      category: "result",
      situations: ["podium"],
      raceTypes: ["itt"],
      text: "Ce podium récompense-t-il une préparation spécifique ou vous laisse-t-il encore un regret ?",
    },
    {
      id: "clm-top10-execution",
      category: "result",
      situations: ["top10"],
      raceTypes: ["itt"],
      text: "Qu’a bien géré {{riderName}} pour entrer dans le top 10 ?",
    },
    {
      id: "clm-top10-benchmark",
      category: "result",
      situations: ["top10"],
      raceTypes: ["itt"],
      text: "Que vous apprend ce chrono sur l’écart qui sépare {{riderName}} des meilleurs spécialistes ?",
    },
    {
      id: "clm-outside-analysis",
      category: "result",
      situations: ["outside"],
      raceTypes: ["itt"],
      text: "Qu’est-ce qui a le plus compliqué ce contre-la-montre pour {{riderName}} ?",
    },
    {
      id: "clm-outside-progress",
      category: "result",
      situations: ["outside"],
      raceTypes: ["itt"],
      text: "Quel axe de progression apparaît le plus clairement après ce contre-la-montre ?",
    },

    // Tactique · courses en ligne
    {
      id: "tactics-breakaway",
      category: "tactics",
      requires: "breakaway",
      text: "La présence d’un de vos coureurs dans l’échappée faisait-elle partie du plan ou était-ce une opportunité de course ?",
    },
    {
      id: "tactics-leader",
      category: "tactics",
      text: "Dans quel scénario auriez-vous demandé à l’équipe de rouler pour son leader ?",
    },
    {
      id: "tactics-hindsight",
      category: "tactics",
      text: "Avec le recul, changeriez-vous quelque chose à votre stratégie sur {{stageName}} ?",
    },
    {
      id: "tactics-chase",
      category: "tactics",
      requires: "chase",
      text: "Qu’est-ce qui vous a décidé à participer à la poursuite ?",
    },
    {
      id: "tactics-isolated",
      category: "tactics",
      text: "De quel type de soutien votre meilleur coureur aurait-il eu le plus besoin dans le final ?",
    },
    {
      id: "tactics-positioning",
      category: "tactics",
      text: "À quel moment le placement dans le peloton a-t-il le plus compté pour votre équipe ?",
    },
    {
      id: "tactics-final-choice",
      category: "tactics",
      text: "Dans le final, quelle décision a été la plus difficile à prendre depuis la voiture ?",
    },
    {
      id: "tactics-roles",
      category: "tactics",
      text: "Les rôles définis avant le départ ont-ils tenu face à la réalité de la course ?",
    },
    {
      id: "tactics-energy",
      category: "tactics",
      text: "Avez-vous dépensé trop d’énergie trop tôt ou, au contraire, attendu trop longtemps ?",
    },
    {
      id: "tactics-radio",
      category: "tactics",
      text: "Quelle consigne aviez-vous donnée pour les passages les plus difficiles ?",
    },
    {
      id: "tactics-plan-b",
      category: "tactics",
      text: "Quel signal vous aurait décidé à abandonner le plan initial ?",
    },
    {
      id: "tactics-selection",
      category: "tactics",
      text: "Quel scénario convenait le mieux à votre équipe pour le final ?",
    },
    {
      id: "tactics-captain",
      category: "tactics",
      text: "Quel coureur a été votre véritable capitaine de route aujourd’hui ?",
    },
    {
      id: "tactics-sacrifice",
      category: "tactics",
      text: "Un de vos coureurs a-t-il dû sacrifier ses propres chances plus tôt que prévu ?",
    },

    // Tactique · CLM individuel
    {
      id: "clm-tactics-pacing",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Aviez-vous demandé un départ prudent, régulier ou très agressif à {{riderName}} ?",
    },
    {
      id: "clm-tactics-splits",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Les temps intermédiaires ont-ils conduit {{riderName}} à modifier son rythme ?",
    },
    {
      id: "clm-tactics-recon",
      category: "tactics",
      raceTypes: ["itt"],
      text: "En préparant ce chrono, aviez-vous repéré des endroits où relancer ou récupérer ?",
    },
    {
      id: "clm-tactics-material",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Êtes-vous pleinement satisfait des choix de matériel et de position pour ce chrono ?",
    },
    {
      id: "clm-tactics-warmup",
      category: "tactics",
      raceTypes: ["itt"],
      text: "L’échauffement et la routine d’avant-départ ont-ils été exécutés comme prévu ?",
    },
    {
      id: "clm-tactics-risk",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Sur quelle partie du parcours conseilleriez-vous à {{riderName}} de faire la différence ?",
    },
    {
      id: "clm-tactics-cadence",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Le choix de cadence et de braquet a-t-il été déterminant aujourd’hui ?",
    },
    {
      id: "clm-tactics-aero",
      category: "tactics",
      raceTypes: ["itt"],
      text: "La position aérodynamique est-elle encore un chantier ou un point fort de {{riderName}} ?",
    },
    {
      id: "clm-tactics-finish",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Vouliez-vous que {{riderName}} garde des forces pour la fin ou maintienne un effort régulier jusqu’à l’arrivée ?",
    },
    {
      id: "clm-tactics-data",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Le parcours s’est-il révélé aussi difficile que vous le pensiez avant le départ ?",
    },

    // Faits de course
    {
      id: "fact-team-breakaway-plan",
      category: "race_fact",
      requires: "breakaway",
      raceTypes: ["road"],
      text: "Votre présence dans l’échappée répondait-elle à un objectif sportif précis ?",
    },
    {
      id: "fact-team-breakaway-return",
      category: "race_fact",
      requires: "breakaway",
      raceTypes: ["road"],
      text: "Qu’avez-vous appris en voyant votre équipe prendre part à l’échappée ?",
    },
    {
      id: "fact-team-breakaway-freedom",
      category: "race_fact",
      requires: "breakaway",
      raceTypes: ["road"],
      text: "Votre coureur avait-il carte blanche dans l’échappée ou des consignes très cadrées ?",
    },
    {
      id: "fact-race-breakaway-control",
      category: "race_fact",
      requires: "race_breakaway",
      raceTypes: ["road"],
      text: "À partir de quel écart l’échappée devenait-elle une menace pour votre équipe ?",
    },
    {
      id: "fact-race-breakaway-gap",
      category: "race_fact",
      requires: "race_breakaway",
      raceTypes: ["road"],
      text: "Le peloton a-t-il accordé trop de marge à l’échappée aujourd’hui ?",
    },
    {
      id: "fact-race-breakaway-value",
      category: "race_fact",
      requires: "race_breakaway",
      raceTypes: ["road"],
      text: "Qu’aurait changé une victoire de l’échappée pour votre équipe ?",
    },
    {
      id: "fact-crash-impact",
      category: "race_fact",
      requires: "crash",
      text: "La chute a-t-elle eu des conséquences pour vos coureurs ou pour votre stratégie ?",
    },
    {
      id: "fact-crash-neutralize",
      category: "race_fact",
      requires: "crash",
      text: "Avez-vous adapté vos consignes après la chute ?",
    },
    {
      id: "fact-crash-tension",
      category: "race_fact",
      requires: "crash",
      text: "Comment vos coureurs ont-ils réagi après la chute ?",
    },
    {
      id: "fact-crosswind-anticipation",
      category: "race_fact",
      requires: "crosswind",
      raceTypes: ["road"],
      text: "Comment aviez-vous préparé vos coureurs au risque de bordures ?",
    },
    {
      id: "fact-crosswind-position",
      category: "race_fact",
      requires: "crosswind",
      raceTypes: ["road"],
      text: "Dans le vent latéral, le placement comptait presque autant que les jambes. Votre équipe était-elle au bon endroit ?",
    },
    {
      id: "fact-crosswind-cost",
      category: "race_fact",
      requires: "crosswind",
      raceTypes: ["road"],
      text: "Les bordures ont-elles coûté de l’énergie à vos coureurs pour le final ?",
    },
    {
      id: "fact-weather-plan",
      category: "race_fact",
      requires: "weather",
      text: "Les conditions annoncées — {{weatherLabel}} — vous ont-elles conduit à adapter le plan initial ?",
    },
    {
      id: "fact-weather-riders",
      category: "race_fact",
      requires: "weather",
      text: "Quels coureurs de votre équipe ont le mieux composé avec les conditions du jour : {{weatherLabel}} ?",
    },
    {
      id: "fact-weather-equipment",
      category: "race_fact",
      requires: "weather",
      text: "Les conditions du jour ont-elles influencé vos choix de matériel ou d’échauffement ?",
    },
    {
      id: "fact-weather-fatigue",
      category: "race_fact",
      requires: "weather",
      text: "Avec la météo du jour ({{weatherLabel}}), vos coureurs ont-ils dû gérer leur effort autrement ?",
    },
    {
      id: "fact-weather-selection",
      category: "race_fact",
      requires: "weather",
      text: "Certains de vos coureurs ont-ils mieux supporté la météo que d’autres ?",
    },

    // Saison, objectifs et classements
    {
      id: "outlook-mood",
      category: "outlook",
      text: "Quel est l’état d’esprit du groupe après l’arrivée ?",
    },
    {
      id: "outlook-character",
      category: "outlook",
      text: "Votre équipe a-t-elle montré le caractère que vous attendiez aujourd’hui ?",
    },
    {
      id: "outlook-uci-gap",
      category: "outlook",
      requires: "uci",
      text: "Votre équipe occupe la place n° {{uciRank}} au classement UCI. Quel rang visez-vous pour la suite ?",
    },
    {
      id: "outlook-uci-pressure",
      category: "outlook",
      requires: "uci",
      text: "Votre équipe occupe la place n° {{uciRank}} au classement UCI. Cette place change-t-elle vos ambitions ?",
    },
    {
      id: "outlook-uci-calendar",
      category: "outlook",
      requires: "uci",
      text: "Le classement UCI va-t-il influencer le choix de vos prochaines courses ?",
    },
    {
      id: "outlook-uci-leader",
      category: "outlook",
      requires: "uci_leader",
      text: "{{uciLeaderName}} mène le classement UCI avec {{uciLeaderTeamName}}. Est-ce aujourd’hui la référence que vos leaders doivent viser ?",
    },
    {
      id: "outlook-uci-leader-gap",
      category: "outlook",
      requires: "uci_leader",
      text: "Dans quels types de courses vos coureurs peuvent-ils rivaliser avec {{uciLeaderName}}, le leader UCI ?",
    },
    {
      id: "outlook-elite",
      category: "outlook",
      text: "Quelle place aimeriez-vous que {{teamName}} occupe dans sa division en fin de saison ?",
    },
    {
      id: "outlook-program",
      category: "outlook",
      text: "Cette performance va-t-elle modifier vos ambitions ou le programme de l’équipe pour la suite ?",
    },
    {
      id: "outlook-year-objective",
      category: "outlook",
      text: "Quel est l’objectif principal de votre équipe cette saison ?",
    },
    {
      id: "outlook-objective-progress",
      category: "outlook",
      text: "À ce stade de la saison, votre équipe est-elle en avance ou en retard sur ses objectifs ?",
    },
    {
      id: "outlook-priority",
      category: "outlook",
      text: "Entre victoires, classement UCI et progression des coureurs, quelle est désormais votre priorité ?",
    },
    {
      id: "outlook-leader",
      category: "outlook",
      text: "Qu’attendez-vous de vos leaders pour la suite de la saison ?",
    },
    {
      id: "outlook-young-riders",
      category: "outlook",
      text: "Quel rôle aimeriez-vous donner à vos jeunes coureurs lors des prochaines courses ?",
    },
    {
      id: "outlook-next-block",
      category: "outlook",
      text: "Quel résultat visez-vous sur les prochaines courses de {{teamName}} ?",
    },
    {
      id: "clm-outlook-training",
      category: "outlook",
      raceTypes: ["itt"],
      text: "Ce chrono va-t-il modifier la place du contre-la-montre dans votre programme d’entraînement ?",
    },
    {
      id: "clm-outlook-specialist",
      category: "outlook",
      raceTypes: ["itt"],
      text: "Aimeriez-vous faire progresser l’un de vos coureurs en contre-la-montre ?",
    },
    {
      id: "clm-outlook-goal",
      category: "outlook",
      raceTypes: ["itt"],
      text: "Avez-vous identifié un prochain contre-la-montre comme objectif majeur de la saison ?",
    },

    // Autres équipes · volontairement occasionnel
    {
      id: "season-rivalry-score",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Votre duel avec {{rivalTeamName}} en est à {{rivalryScore}}. Qu’est-ce qui a fait la différence aujourd’hui ?",
    },
    {
      id: "season-rivalry-director",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Vous êtes opposé toute la saison à {{rivalDirectorName}} et {{rivalTeamName}}. Cette rivalité influence-t-elle réellement vos décisions sportives ?",
    },
    {
      id: "season-rivalry-result",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Le meilleur coureur de {{rivalTeamName}}, {{rivalRiderName}}, termine {{rivalRank}}. Que retenez-vous de cette confrontation directe ?",
    },
    {
      id: "season-rivalry-origin",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Sur quels types de courses pensez-vous pouvoir faire la différence face à {{rivalTeamName}} ?",
    },
    {
      id: "season-rivalry-stakes",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Le duel avec {{rivalTeamName}} en est à {{rivalryScore}}. Cela change-t-il votre façon de préparer les courses où vous vous retrouverez ?",
    },
    {
      id: "season-rivalry-pressure",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Le duel avec {{rivalTeamName}} motive-t-il vos coureurs avant les courses que vous disputez ensemble ?",
    },
    {
      id: "season-rivalry-message",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Après cette nouvelle manche, quel message souhaitez-vous adresser directement à {{rivalDirectorName}} ?",
    },
    {
      id: "season-rivalry-priority",
      category: "rivalry",
      requires: "season_rivalry",
      text: "Seriez-vous prêt à modifier un rôle ou une tactique uniquement pour prendre le dessus sur {{rivalTeamName}} lors de votre prochaine course commune ?",
    },
    {
      id: "rivalry-winner-team",
      category: "rivalry",
      requires: "rival_winner",
      text: "{{rivalRiderName}} s’est imposé avec {{rivalTeamName}}. Quel regard portez-vous sur cette équipe et le travail de {{rivalDirectorName}} ?",
    },
    {
      id: "rivalry-winner-strength",
      category: "rivalry",
      requires: "rival_winner",
      text: "Quelle a été, selon vous, la principale force de {{rivalTeamName}} pour aller chercher la victoire ?",
    },
    {
      id: "rivalry-runner-up-team",
      category: "rivalry",
      requires: "rival_runner_up",
      text: "{{rivalRiderName}} termine deuxième avec {{rivalTeamName}}. Que vous inspire leur performance ?",
    },
    {
      id: "rivalry-runner-up-future",
      category: "rivalry",
      requires: "rival_runner_up",
      text: "Le deuxième, {{rivalRiderName}}, vous semble-t-il capable de transformer rapidement ce résultat en victoire ?",
    },
    {
      id: "rivalry-director-mentality",
      category: "rivalry",
      requires: "rival_winner",
      text: "Quel point fort avez-vous remarqué chez {{rivalTeamName}} aujourd’hui ?",
    },
    {
      id: "rivalry-respect",
      category: "rivalry",
      requires: "rival_winner",
      text: "Entre {{teamName}} et {{rivalTeamName}}, parle-t-on de rivalité, de respect ou un peu des deux ?",
    },
    {
      id: "rivalry-tactics",
      category: "rivalry",
      requires: "rival_winner",
      text: "Comment jugez-vous les choix tactiques de {{rivalDirectorName}} aujourd’hui ?",
    },
    {
      id: "rivalry-future",
      category: "rivalry",
      requires: "rival_winner",
      text: "{{rivalTeamName}} vous semble-t-elle être l’une des équipes à suivre pour la suite de la saison ?",
    },
    {
      id: "rivalry-message",
      category: "rivalry",
      requires: "rival_winner",
      text: "Quel message adresseriez-vous à {{rivalDirectorName}} après cette course ?",
    },
    {
      id: "rebound-direct",
      category: "rivalry",
      requires: "rival_quote",
      text: "Comment répondez-vous à {{rivalDirectorName}}, qui a déclaré : « {{rivalQuote}} » ?",
    },
    {
      id: "rebound-surprised",
      category: "rivalry",
      requires: "rival_quote",
      text: "Les propos de {{rivalDirectorName}} — « {{rivalQuote}} » — vous surprennent-ils ?",
    },
    {
      id: "rebound-rivalry",
      category: "rivalry",
      requires: "rival_quote",
      text: "Les propos de {{rivalDirectorName}} — « {{rivalQuote}} » — changent-ils votre façon d’aborder les prochaines courses face à {{rivalTeamName}} ?",
    },
    {
      id: "rebound-clarify",
      category: "rivalry",
      requires: "rival_quote",
      text: "Quel est votre point de vue sur les propos de {{rivalDirectorName}} : « {{rivalQuote}} » ?",
    },
    {
      id: "rebound-pressure",
      category: "rivalry",
      requires: "rival_quote",
      text: "Pensez-vous que les propos de {{rivalDirectorName}} — « {{rivalQuote}} » — auront un effet sur vos coureurs ?",
    },
    {
      id: "rebound-next-race",
      category: "rivalry",
      requires: "rival_quote",
      text: "« {{rivalQuote}} » : ces propos de {{rivalDirectorName}} auront-ils une influence lors de votre prochaine confrontation ?",
    },
  ];

export function selectPostRaceInterviewQuestions(
  context: PostRaceInterviewContext,
  seed: string,
  recentQuestions: readonly Pick<PostRaceInterviewQuestion, "id" | "topic">[] = [],
): PostRaceInterviewQuestion[] {
  const definitions = eligibleQuestions(context);
  const render = (definition: QuestionDefinition): PostRaceInterviewQuestion => ({
    id: definition.id,
    category: definition.category,
    text: renderQuestion(definition.text, context),
    ...(definition.category === "rivalry" && context.rivalry
      ? {
          subjectTeamId: context.rivalry.teamId,
          sourceInterviewId: context.rivalry.kind === "rebound"
            ? context.rivalry.sourceInterviewId
            : undefined,
        }
      : {}),
  });
  const detailed = buildDetailedRaceInterviewQuestions(context);
  const editorial = buildPostRaceEditorialQuestions(context);
  const isTeamTrial = context.stageType === "team_time_trial";
  const situation = getResultSituation(context.bestRank);
  const resultFallback = isTeamTrial
    ? TEAM_TIME_TRIAL_INTERVIEW_FALLBACK.filter(({ category }) => category === "result")
    : definitions.filter(({ category, situations }) =>
        category === "result" && situations?.includes(situation),
      ).map(render);
  const momentFallback = isTeamTrial
    ? TEAM_TIME_TRIAL_INTERVIEW_FALLBACK.filter(({ category }) => category === "tactics")
    : definitions.filter(({ category }) =>
        category === "tactics" || category === "race_fact",
      ).map(render);

  const selected: PostRaceInterviewQuestion[] = [];
  const topicOf = (question: Pick<PostRaceInterviewQuestion, "id" | "topic">) =>
    question.topic ?? question.id;
  const recentIds = new Set(recentQuestions.map(({ id }) => id));
  const recentTopicIndexes = new Map<string, number>();
  for (const [index, question] of recentQuestions.entries()) {
    const topic = topicOf(question);
    if (!recentTopicIndexes.has(topic)) recentTopicIndexes.set(topic, index);
  }

  function add(preferred: PostRaceInterviewQuestion[], fallback: PostRaceInterviewQuestion[]) {
    const unused = (candidate: PostRaceInterviewQuestion) =>
      selected.every((question) => topicOf(question) !== topicOf(candidate));
    const available = preferred.filter(unused);
    const candidates = available.length ? available : fallback.filter(unused);
    const topics = [...new Set(candidates.map(topicOf))];
    const unseenTopics = topics.filter((topic) => !recentTopicIndexes.has(topic));
    const nextTopic = unseenTopics.length
      ? unseenTopics[seededInterviewIndex([seed, "topic", selected.length].join(":"), unseenTopics.length)]
      : topics.sort((a, b) => (recentTopicIndexes.get(b) ?? -1) - (recentTopicIndexes.get(a) ?? -1))[0];
    const variants = candidates.filter((question) => topicOf(question) === nextTopic);
    const unusedVariants = variants.filter(({ id }) => !recentIds.has(id));
    const pool = unusedVariants.length ? unusedVariants : variants;
    const question = pool[seededInterviewIndex([seed, selected.length].join(":"), pool.length)];
    if (!question) throw new Error("Aucune question de zone mixte n’est disponible.");
    selected.push(question);
  }

  add(detailed.filter(({ category }) => category === "result"), resultFallback);
  add(detailed.filter(({ category }) => category !== "result"), momentFallback);

  if (context.zoneMixteEvent) {
    selected.push({
      id: "event:" + context.zoneMixteEvent.id,
      category: "event",
      text: context.zoneMixteEvent.title,
    });
  } else {
    const outlook = definitions.filter(({ category }) => category === "outlook").map(render);
    const rivalry = definitions.filter(({ category }) => category === "rivalry").map(render);
    add(
      shouldAskRivalryQuestion(context, seed) ? rivalry : editorial,
      editorial.length ? editorial : outlook,
    );
  }

  return selected;
}

function eligibleQuestions(context: PostRaceInterviewContext) {
  const raceType = getInterviewRaceType(context);

  return POST_RACE_INTERVIEW_QUESTION_POOL.filter((question) => {
    if (question.raceTypes && !question.raceTypes.includes(raceType)) {
      return false;
    }
    if (
      raceType === "itt" &&
      !question.raceTypes &&
      (question.category === "result" || question.category === "tactics")
    ) {
      return false;
    }
    if (question.text.includes("{{gapLabel}}") && !context.gapLabel) return false;
    if (question.requires === "breakaway") return raceType === "road" && context.tookBreakaway;
    if (question.requires === "race_breakaway") {
      return raceType === "road" && Boolean(context.raceFacts?.breakawayOccurred);
    }
    if (question.requires === "chase") return raceType === "road" && context.tookChase;
    if (question.requires === "crash") {
      return Boolean(context.raceFacts?.crashOccurred);
    }
    if (question.requires === "crosswind") {
      return raceType === "road" && Boolean(context.raceFacts?.crosswindOccurred);
    }
    if (question.requires === "weather") return Boolean(context.weatherLabel);
    if (question.requires === "uci") return context.uciRank !== null;
    if (question.requires === "uci_leader") {
      return Boolean(context.uciLeaderName && context.uciLeaderTeamName);
    }
    if (question.requires === "rival_winner") {
      return (
        context.rivalry?.kind === "opinion" &&
        context.rivalry.achievement === "winner"
      );
    }
    if (question.requires === "rival_runner_up") {
      return (
        context.rivalry?.kind === "opinion" &&
        context.rivalry.achievement === "runner_up"
      );
    }
    if (question.requires === "rival_quote") {
      return context.rivalry?.kind === "rebound";
    }
    if (question.requires === "season_rivalry") {
      return context.rivalry?.kind === "season_rivalry";
    }
    return true;
  });
}

function shouldAskRivalryQuestion(
  context: PostRaceInterviewContext,
  seed: string,
) {
  if (!context.rivalry) return false;
  const frequency = context.rivalry.kind === "season_rivalry"
    ? (context.editorialFacts ? 3 : 1)
    : context.rivalry.kind === "opinion"
      ? 4
      : 2;
  return seededInterviewIndex(`${seed}:rivalry`, frequency) === 0;
}

function getInterviewRaceType(context: PostRaceInterviewContext) {
  return context.stageType === "individual_time_trial" || context.stageType === "prologue" ? "itt" : "road";
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
    gapLabel: context.gapLabel ?? "",
    weatherLabel: context.weatherLabel ?? "des conditions changeantes",
    uciRank: String(context.uciRank ?? "—"),
    uciLeaderName: context.uciLeaderName ?? "le leader UCI",
    uciLeaderTeamName: context.uciLeaderTeamName ?? "son équipe",
    rivalTeamName: context.rivalry?.teamName ?? "l’équipe rivale",
    rivalDirectorName: context.rivalry?.directorName ?? "le DS adverse",
    rivalRiderName:
      context.rivalry?.kind === "opinion" || context.rivalry?.kind === "season_rivalry"
        ? context.rivalry.riderName
        : "Le coureur adverse",
    rivalRank:
      context.rivalry?.kind === "season_rivalry"
        ? `${context.rivalry.rivalRank}${context.rivalry.rivalRank === 1 ? "er" : "e"}`
        : "—",
    rivalryScore:
      context.rivalry?.kind === "season_rivalry"
        ? `${context.rivalry.ownScore}–${context.rivalry.rivalScore}`
        : "—",
    rivalQuote:
      context.rivalry?.kind === "rebound" ? context.rivalry.quote : "",
  };

  return template.replace(
    /{{(\w+)}}/g,
    (_match, key: string) => values[key] ?? "",
  );
}

export function seededInterviewIndex(seed: string, length: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // Mix the final bits so related seeds do not favor the same positions in even-sized pools.
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) % Math.max(1, length);
}
