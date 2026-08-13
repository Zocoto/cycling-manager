export type PostRaceInterviewQuestionCategory =
  "result" | "tactics" | "race_fact" | "outlook" | "rivalry";

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
  bestRank: number | null;
  gapLabel: string | null;
  uciRank: number | null;
  divisionLabel: string | null;
  uciLeaderName?: string | null;
  uciLeaderTeamName?: string | null;
  tookBreakaway: boolean;
  tookChase: boolean;
  raceFacts?: PostRaceInterviewRaceFacts;
  rivalry?: PostRaceInterviewRivalryContext | null;
};

export type PostRaceInterviewSnapshot = {
  id: string;
  status: "pending" | "submitted" | "closed";
  questions: PostRaceInterviewQuestion[];
  answers: PostRaceInterviewAnswer[];
  closingNote: string;
  context: PostRaceInterviewContext;
  submittedAt: string | null;
};

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
  | "rival_quote";

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
      text: "Votre plan semble avoir été exécuté à la perfection. La course s’est-elle vraiment déroulée comme prévu ?",
    },
    {
      id: "win-final-message",
      category: "result",
      situations: ["win"],
      text: "Qu’avez-vous dit à {{riderName}} dans les derniers kilomètres ?",
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
      text: "Quel risque avez-vous accepté de prendre pour aller chercher ce succès ?",
    },
    {
      id: "win-symbol",
      category: "result",
      situations: ["win"],
      text: "Cette victoire raconte-t-elle quelque chose de nouveau sur l’identité de {{teamName}} ?",
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
      text: "Étiez-vous venus sur {{raceName}} avec l’ambition de monter sur le podium ?",
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
      text: "Ce résultat confirme-t-il que {{riderName}} peut bientôt franchir le cap de la victoire ?",
    },
    {
      id: "podium-regret",
      category: "result",
      situations: ["podium"],
      text: "Quel détail vous empêche de repartir pleinement satisfait de ce podium ?",
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
      text: "Qu’a-t-il manqué à vos coureurs pour accompagner les meilleurs jusqu’au bout ?",
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
      text: "Malgré l’absence de podium, quels signaux positifs retenez-vous de cette journée ?",
    },
    {
      id: "top10-ceiling",
      category: "result",
      situations: ["top10"],
      text: "Ce résultat reflète-t-il votre niveau actuel ou seulement le scénario du jour ?",
    },
    {
      id: "top10-aggression",
      category: "result",
      situations: ["top10"],
      text: "Avez-vous été assez entreprenants pour transformer ce top 10 en résultat majeur ?",
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
      text: "Votre équipe n’a jamais réellement pesé sur la course. Est-ce une déception ?",
    },
    {
      id: "outside-cause",
      category: "result",
      situations: ["outside"],
      text: "Cette contre-performance est-elle physique, tactique ou collective ?",
    },
    {
      id: "outside-opportunity",
      category: "result",
      situations: ["outside"],
      text: "Le profil de {{raceName}} semblait pourtant vous convenir. Avez-vous manqué une occasion ?",
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
      text: "Y a-t-il malgré tout une satisfaction que le classement brut ne raconte pas ?",
    },
    {
      id: "outside-expectations",
      category: "result",
      situations: ["outside"],
      text: "Aviez-vous surestimé vos chances avant le départ ou l’équipe a-t-elle simplement connu un mauvais jour ?",
    },
    {
      id: "outside-responsibility",
      category: "result",
      situations: ["outside"],
      text: "Dans quelle mesure assumez-vous personnellement ce résultat en tant que DS ?",
    },
    {
      id: "outside-response",
      category: "result",
      situations: ["outside"],
      text: "Attendez-vous une réaction immédiate de vos leaders dès la prochaine course ?",
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
      text: "Cette victoire place-t-elle {{riderName}} parmi vos références absolues contre la montre ?",
    },
    {
      id: "clm-podium-splits",
      category: "result",
      situations: ["podium"],
      raceTypes: ["itt"],
      text: "Votre coureur termine sur le podium du chrono {{gapLabel}} : sur quelle portion le temps s’est-il joué ?",
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
      text: "Ce top 10 reflète-t-il une exécution parfaite ou reste-t-il du temps à gagner ?",
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
      text: "Le chrono n’a pas répondu à vos attentes. Le problème venait-il des jambes, du rythme ou du matériel ?",
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
      text: "L’équipe a longtemps roulé pour son leader. Était-ce pour contrôler la course ou provoquer une sélection ?",
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
      text: "Le peloton a laissé partir un groupe dangereux. Avez-vous hésité à organiser la poursuite plus tôt ?",
    },
    {
      id: "tactics-isolated",
      category: "tactics",
      text: "Votre leader s’est retrouvé isolé dans le final. Était-ce prévu ou avez-vous perdu des équipiers trop tôt ?",
    },
    {
      id: "tactics-positioning",
      category: "tactics",
      text: "Le placement avant les moments clés était-il suffisamment travaillé ?",
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
      text: "Les informations transmises par radio ont-elles modifié votre lecture de la course ?",
    },
    {
      id: "tactics-plan-b",
      category: "tactics",
      text: "À quel moment avez-vous abandonné le plan initial pour passer au plan B ?",
    },
    {
      id: "tactics-selection",
      category: "tactics",
      text: "Cherchiez-vous à durcir la course ou à conserver le plus de cartes possible pour le final ?",
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
      text: "La reconnaissance du parcours a-t-elle permis de cibler précisément les zones où relancer ?",
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
      text: "Où aviez-vous autorisé {{riderName}} à prendre le plus de risques sur le parcours ?",
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
      text: "Aviez-vous demandé de garder une réserve pour le final ou de tout lisser jusqu’à la ligne ?",
    },
    {
      id: "clm-tactics-data",
      category: "tactics",
      raceTypes: ["itt"],
      text: "Les données préparées avant le départ ont-elles confirmé ce que le coureur a ressenti sur la route ?",
    },

    // Faits de course
    {
      id: "fact-team-breakaway-plan",
      category: "race_fact",
      requires: "breakaway",
      raceTypes: ["road"],
      text: "Votre présence dans l’échappée matinale répondait-elle à un objectif sportif précis ?",
    },
    {
      id: "fact-team-breakaway-return",
      category: "race_fact",
      requires: "breakaway",
      raceTypes: ["road"],
      text: "Qu’avez-vous appris de la longue échappée menée par votre équipe aujourd’hui ?",
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
      text: "L’échappée matinale a longtemps animé la course. À quel moment est-elle devenue une vraie menace ?",
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
      text: "L’échappée a-t-elle davantage servi les attaquants ou les équipes restées en contrôle dans le peloton ?",
    },
    {
      id: "fact-crash-impact",
      category: "race_fact",
      requires: "crash",
      text: "Une chute a marqué la journée. A-t-elle changé votre manière d’aborder la suite de la course ?",
    },
    {
      id: "fact-crash-neutralize",
      category: "race_fact",
      requires: "crash",
      text: "Après la chute, avez-vous demandé à vos coureurs de temporiser ou de rester concentrés sur leur propre course ?",
    },
    {
      id: "fact-crash-tension",
      category: "race_fact",
      requires: "crash",
      text: "La nervosité provoquée par la chute était-elle perceptible jusque dans votre voiture ?",
    },
    {
      id: "fact-crosswind-anticipation",
      category: "race_fact",
      requires: "crosswind",
      raceTypes: ["road"],
      text: "Les bordures ont cassé le rythme de la course. Aviez-vous suffisamment anticipé ce danger ?",
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
      text: "Quel prix énergétique les bordures ont-elles fait payer à vos coureurs ?",
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
      text: "Quel impact les conditions — {{weatherLabel}} — ont-elles eu sur la fatigue après l’arrivée ?",
    },
    {
      id: "fact-weather-selection",
      category: "race_fact",
      requires: "weather",
      text: "La météo a-t-elle réellement sélectionné les plus forts ou seulement rendu la course plus imprévisible ?",
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
      text: "Vous occupez actuellement la {{uciRank}}e place au classement UCI. Que vous manque-t-il pour progresser ?",
    },
    {
      id: "outlook-uci-pressure",
      category: "outlook",
      requires: "uci",
      text: "Votre {{uciRank}}e place au classement UCI crée-t-elle de la sérénité ou une obligation de résultat ?",
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
      text: "Que sépare encore vos meilleurs coureurs du leader UCI, {{uciLeaderName}} ?",
    },
    {
      id: "outlook-elite",
      category: "outlook",
      text: "La montée en Élite est-elle un objectif réaliste pour {{teamName}} cette saison ?",
    },
    {
      id: "outlook-program",
      category: "outlook",
      text: "Cette performance va-t-elle modifier vos ambitions ou le programme de l’équipe pour la suite ?",
    },
    {
      id: "outlook-year-objective",
      category: "outlook",
      text: "Quel objectif majeur fixé en début d’année guide encore toutes vos décisions ?",
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
      text: "Votre leader actuel répond-il aux attentes placées en lui avant la saison ?",
    },
    {
      id: "outlook-young-riders",
      category: "outlook",
      text: "Cette course peut-elle changer la place de certains jeunes dans votre hiérarchie ?",
    },
    {
      id: "outlook-next-block",
      category: "outlook",
      text: "Quel sera le fil conducteur du prochain bloc de courses pour {{teamName}} ?",
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
      text: "Souhaitez-vous construire un véritable spécialiste du chrono au sein de {{teamName}} ?",
    },
    {
      id: "clm-outlook-goal",
      category: "outlook",
      raceTypes: ["itt"],
      text: "Avez-vous identifié un prochain contre-la-montre comme objectif majeur de la saison ?",
    },

    // Autres équipes · volontairement occasionnel
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
      text: "Que pensez-vous de la mentalité insufflée par {{rivalDirectorName}} à {{rivalTeamName}} ?",
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
      text: "{{rivalDirectorName}} a déclaré à votre sujet : « {{rivalQuote}} ». Qu’avez-vous à lui répondre ?",
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
      text: "Après ces mots de {{rivalDirectorName}} — « {{rivalQuote}} » — la rivalité entre {{teamName}} et {{rivalTeamName}} change-t-elle de dimension ?",
    },
    {
      id: "rebound-clarify",
      category: "rivalry",
      requires: "rival_quote",
      text: "{{rivalDirectorName}} affirme : « {{rivalQuote}} ». Souhaitez-vous rectifier ou nuancer ses propos ?",
    },
    {
      id: "rebound-pressure",
      category: "rivalry",
      requires: "rival_quote",
      text: "La sortie de {{rivalDirectorName}} — « {{rivalQuote}} » — ajoute-t-elle une pression particulière sur votre groupe ?",
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
): PostRaceInterviewQuestion[] {
  const situation = getResultSituation(context.bestRank);
  const questions = eligibleQuestions(context);
  const resultQuestions = questions.filter(
    (question) =>
      question.category === "result" &&
      question.situations?.includes(situation),
  );
  const middleQuestions = questions.filter(
    (question) =>
      question.category === "tactics" || question.category === "race_fact",
  );
  const outlookQuestions = questions.filter(
    (question) => question.category === "outlook",
  );
  const rivalryQuestions = questions.filter(
    (question) => question.category === "rivalry",
  );
  const closingQuestions = shouldAskRivalryQuestion(context, seed)
    ? rivalryQuestions
    : outlookQuestions;

  return [resultQuestions, middleQuestions, closingQuestions].map(
    (candidates, index) => {
      const fallback = index === 2 ? outlookQuestions : candidates;
      const available = candidates.length > 0 ? candidates : fallback;
      const question =
        available[seededIndex(`${seed}:${index}`, available.length)];
      if (!question) {
        throw new Error("Aucune question de zone mixte n’est disponible.");
      }

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
    if (question.requires === "breakaway") return context.tookBreakaway;
    if (question.requires === "race_breakaway") {
      return Boolean(context.raceFacts?.breakawayOccurred);
    }
    if (question.requires === "chase") return context.tookChase;
    if (question.requires === "crash") {
      return Boolean(context.raceFacts?.crashOccurred);
    }
    if (question.requires === "crosswind") {
      return Boolean(context.raceFacts?.crosswindOccurred);
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
    return true;
  });
}

function shouldAskRivalryQuestion(
  context: PostRaceInterviewContext,
  seed: string,
) {
  if (!context.rivalry) return false;
  const frequency = context.rivalry.kind === "rebound" ? 2 : 4;
  return seededIndex(`${seed}:rivalry`, frequency) === 0;
}

function getInterviewRaceType(context: PostRaceInterviewContext) {
  return context.stageType === "individual_time_trial" ? "itt" : "road";
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
    weatherLabel: context.weatherLabel ?? "des conditions changeantes",
    uciRank: String(context.uciRank ?? "—"),
    uciLeaderName: context.uciLeaderName ?? "le leader UCI",
    uciLeaderTeamName: context.uciLeaderTeamName ?? "son équipe",
    rivalTeamName: context.rivalry?.teamName ?? "l’équipe rivale",
    rivalDirectorName: context.rivalry?.directorName ?? "le DS adverse",
    rivalRiderName:
      context.rivalry?.kind === "opinion"
        ? context.rivalry.riderName
        : "Le coureur adverse",
    rivalQuote:
      context.rivalry?.kind === "rebound" ? context.rivalry.quote : "",
  };

  return template.replace(
    /{{(\w+)}}/g,
    (_match, key: string) => values[key] ?? "",
  );
}

function seededIndex(seed: string, length: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, length);
}
