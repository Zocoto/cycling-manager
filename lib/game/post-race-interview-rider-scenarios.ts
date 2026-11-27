import type { ZoneMixteEventRarity } from "./post-race-interview";

export type RiderCommunicationApproach =
  | "listen" | "protect" | "praise" | "analyse"
  | "challenge" | "autonomy" | "collective" | "accountability";

export type RiderInterviewScenarioRequirement =
  | "win" | "runner-up" | "podium" | "top-ten"
  | "leader-off-pace" | "setback" | "crash" | "dropped"
  | "pursuit" | "dnf" | "otl" | "individual-time-trial"
  | "team-time-trial" | "low-morale" | "support-after-team-podium" | "finished";

type RiderInterviewReply = {
  id: string;
  label: string;
  description: string;
  approach: RiderCommunicationApproach;
  baseMorale: number;
  popularityDelta?: number;
};

export type RiderInterviewScenario = {
  id: string;
  requires: RiderInterviewScenarioRequirement;
  rarity: ZoneMixteEventRarity;
  title: string;
  story: string;
  choices: readonly RiderInterviewReply[];
};

export const RIDER_INTERVIEW_SCENARIOS: readonly RiderInterviewScenario[] = [
  {
    id: "rider-first-microphone-after-win",
    requires: "win",
    rarity: "common",
    title: "Le micro du vainqueur",
    story: "{{riderName}} vient de gagner. Les journalistes vous demandent ce qui a fait la différence. Quelle place donnez-vous au coureur et à l’équipe dans votre réponse ?",
    choices: [
      {
        id: "spotlight-winner", approach: "praise", baseMorale: 1, popularityDelta: 1,
        label: "Saluer la décision qui a fait la différence",
        description: "Laisser au coureur le soin de raconter son effort et féliciter son exécution.",
      },
      {
        id: "share-credit", approach: "collective", baseMorale: 1,
        label: "Partager le mérite",
        description: "Donner autant de place à la préparation de l’équipe qu’à la conclusion du vainqueur.",
      },
      {
        id: "let-it-sink-in", approach: "listen", baseMorale: 1,
        label: "Laisser le coureur savourer",
        description: "Restreindre l’interview et lui demander au bus comment la victoire s’est construite de son point de vue.",
      },
      {
        id: "demand-a-repeat", approach: "challenge", baseMorale: -1,
        label: "Relever les attentes dès maintenant",
        description: "Dire que ce résultat ouvre la porte à d’autres victoires et que vous en attendez la confirmation.",
      },
    ],
  },
  {
    id: "rider-second-place-headlines",
    requires: "runner-up",
    rarity: "common",
    title: "Une deuxième place à raconter",
    story: "{{riderName}} a terminé deuxième. En zone mixte, on vous demande si vous voyez d’abord le résultat ou la victoire manquée.",
    choices: [
      {
        id: "preserve-perspective", approach: "protect", baseMorale: 1,
        label: "Défendre la valeur de la deuxième place",
        description: "Rappeler ce que vaut cette performance sans faire le procès du résultat.",
      },
      {
        id: "compare-final", approach: "analyse", baseMorale: 1,
        label: "Reprendre le final avec le coureur",
        description: "Comparer vos lectures de la fin de course avant de décider d’un ajustement.",
      },
      {
        id: "name-performance", approach: "praise", baseMorale: 1, popularityDelta: 1,
        label: "Mettre la performance en avant",
        description: "Dire devant la presse que cette deuxième place mérite d’être reconnue.",
      },
      {
        id: "win-next-time", approach: "challenge", baseMorale: -1,
        label: "Faire de la victoire la prochaine étape",
        description: "Dire au coureur que ce résultat montre qu’il peut désormais jouer pour la gagne.",
      },
    ],
  },
  {
    id: "rider-podium-photo-pressure",
    requires: "podium",
    rarity: "common",
    title: "Juste après le podium",
    story: "La cérémonie est à peine terminée et les micros attendent déjà {{riderName}}. Le podium mérite un mot, mais les questions sur la suite arrivent vite.",
    choices: [
      {
        id: "celebrate-achievement", approach: "praise", baseMorale: 1, popularityDelta: 1,
        label: "Saluer le podium au micro",
        description: "Mettre en avant le résultat du jour et donner la parole au coureur.",
      },
      {
        id: "make-time-at-bus", approach: "listen", baseMorale: 1,
        label: "Garder le bilan pour le bus",
        description: "Féliciter le coureur en tête-à-tête et lui laisser le temps de dire ce qu’il retient de la course.",
      },
      {
        id: "keep-interview-short", approach: "protect", baseMorale: 1,
        label: "Prendre en charge les questions sur la suite",
        description: "Limiter la prise de parole du coureur au résultat du jour.",
      },
      {
        id: "state-new-expectation", approach: "challenge", baseMorale: -1,
        label: "Annoncer le prochain cap",
        description: "Dire que le podium doit servir de point de départ pour viser plus haut.",
      },
    ],
  },
  {
    id: "rider-top-ten-role-review",
    requires: "top-ten",
    rarity: "common",
    title: "Un top 10 qui pose la question du rôle",
    story: "{{riderName}} entre dans le top 10. Un journaliste vous demande si ce résultat peut changer sa place dans votre plan de course.",
    choices: [
      {
        id: "praise-top-ten", approach: "praise", baseMorale: 1, popularityDelta: 1,
        label: "Saluer le résultat du jour",
        description: "Reconnaître publiquement cette place sans annoncer de nouveau statut.",
      },
      {
        id: "offer-tactical-room", approach: "autonomy", baseMorale: 1,
        label: "Lui ouvrir une marge de décision",
        description: "Proposer qu’il puisse décider de suivre une ouverture sur un parcours qui lui convient.",
      },
      {
        id: "define-next-step", approach: "analyse", baseMorale: 1,
        label: "Fixer un prochain point de travail",
        description: "Revoir avec lui le moment où le classement s’est joué et choisir un axe de travail.",
      },
      {
        id: "share-top-ten-goal", approach: "collective", baseMorale: 0,
        label: "Le replacer dans le projet d’équipe",
        description: "Reconnaître son résultat et rappeler que les rôles continueront à dépendre du parcours et de la sélection.",
      },
    ],
  },
  {
    id: "rider-leader-outside-objectives",
    requires: "leader-off-pace",
    rarity: "notable",
    title: "Le leader hors du top 10",
    story: "{{riderName}} avait la responsabilité de mener l’équipe et a terminé hors du top 10. Devant les micros, on vous demande d’expliquer le résultat.",
    choices: [
      {
        id: "review-leadership-plan", approach: "accountability", baseMorale: 1,
        label: "Assumer votre part dans le résultat",
        description: "Faire le bilan de vos consignes avant de commenter les décisions du coureur.",
      },
      {
        id: "defer-dissection", approach: "protect", baseMorale: 1,
        label: "Préserver le coureur devant les micros",
        description: "Garder les critiques pour le débrief et répondre simplement sur le classement.",
      },
      {
        id: "set-leader-standard", approach: "challenge", baseMorale: -2,
        label: "Rappeler publiquement les attentes",
        description: "Dire que ce bilan appelle une réponse du leader lors du prochain rendez-vous.",
      },
      {
        id: "hear-leaders-view", approach: "listen", baseMorale: 2,
        label: "Écouter sa lecture avant de conclure",
        description: "Parler ensemble au bus du moment où la course lui a échappé.",
      },
    ],
  },
  {
    id: "rider-reset-after-setback",
    requires: "setback",
    rarity: "common",
    title: "Remettre la course en perspective",
    story: "La course de {{riderName}} a été compliquée par un incident. Au retour au bus, le coureur veut savoir ce que vous retenez de sa journée.",
    choices: [
      {
        id: "hear-debrief", approach: "listen", baseMorale: 2,
        label: "Commencer par son récit",
        description: "Lui laisser raconter ce qu’il a vécu avant d’évaluer le reste de la course.",
      },
      {
        id: "isolate-turning-point", approach: "analyse", baseMorale: 1,
        label: "Isoler le moment décisif",
        description: "Faire la part entre ce qui relevait de l’incident et ce sur quoi vous pouvez travailler ensemble.",
      },
      {
        id: "take-media-questions", approach: "protect", baseMorale: 1,
        label: "Répondre à la presse pour lui",
        description: "Donner les faits et lui laisser la maîtrise de ce qu’il souhaite rendre public.",
      },
      {
        id: "set-reset-target", approach: "challenge", baseMorale: -1,
        label: "Fixer un objectif de rebond",
        description: "Lui demander de se projeter tout de suite sur un prochain rendez-vous où il pourra repartir de l’avant.",
      },
    ],
  },
  {
    id: "rider-finish-after-crash",
    requires: "crash",
    rarity: "notable",
    title: "Finir après la chute",
    story: "{{riderName}} est tombé au km {{incidentKm}} et a rejoint l’arrivée. Les caméras le cherchent pendant qu’il regagne le bus.",
    choices: [
      {
        id: "keep-cameras-away", approach: "protect", baseMorale: 2,
        label: "Écarter les caméras",
        description: "Assurer vous-même le point presse et laisser le coureur décider s’il souhaite témoigner.",
      },
      {
        id: "ask-about-restart", approach: "listen", baseMorale: 2,
        label: "Écouter ce qu’a coûté la reprise",
        description: "Lui demander au calme ce qui l’a aidé à repartir et comment il a vécu la fin de course.",
      },
      {
        id: "highlight-commitment", approach: "praise", baseMorale: 0, popularityDelta: 1,
        label: "Saluer sa persévérance au micro",
        description: "Rendre hommage à son effort sans spéculer sur les conséquences de la chute.",
      },
      {
        id: "review-crash-sequence", approach: "analyse", baseMorale: 0,
        label: "Reconstituer le déroulement",
        description: "Vérifier ensemble ce qui s’est passé quand il se sent prêt à en parler.",
      },
    ],
  },
  {
    id: "rider-lost-wheel-feedback",
    requires: "dropped",
    rarity: "common",
    title: "Comprendre le décrochage",
    story: "{{riderName}} a perdu le contact avec son groupe au km {{dropKm}}. Au débrief, il vous demande ce que vous avez vu depuis la voiture.",
    choices: [
      {
        id: "compare-observations", approach: "analyse", baseMorale: 2,
        label: "Comparer les observations",
        description: "Reprendre ce passage pour distinguer le placement, le rythme et les sensations.",
      },
      {
        id: "let-rider-call-it", approach: "autonomy", baseMorale: 1,
        label: "Lui laisser donner l’alerte",
        description: "Convenez qu’il signale lui-même le moment où il doit changer de rythme.",
      },
      {
        id: "private-reaction", approach: "listen", baseMorale: 1,
        label: "L’écouter avant de donner un avis",
        description: "Recueillir sa lecture du décrochage et ce qui l’aurait aidé sur le moment.",
      },
      {
        id: "towards-stronger-finish", approach: "challenge", baseMorale: -1,
        label: "Demander une réaction plus rapide",
        description: "Lui dire que vous attendez qu’il se signale plus tôt dès le prochain passage difficile.",
      },
    ],
  },
  {
    id: "rider-chase-initiative-review",
    requires: "pursuit",
    rarity: "common",
    title: "Prendre la poursuite en main",
    story: "{{riderName}} figurait dans le groupe de poursuite au km {{pursuitKm}}. Au retour, il vous demande comment vous avez jugé cette initiative.",
    choices: [
      {
        id: "back-next-move", approach: "autonomy", baseMorale: 2,
        label: "Lui laisser lire la prochaine ouverture",
        description: "Convenir ensemble des circonstances dans lesquelles il pourra engager une poursuite.",
      },
      {
        id: "share-chase-work", approach: "collective", baseMorale: 1,
        label: "Revenir sur le travail du groupe",
        description: "Voir comment l’équipe aurait pu répartir ses efforts une fois la poursuite lancée.",
      },
      {
        id: "check-pursuit-cost", approach: "analyse", baseMorale: 1,
        label: "Évaluer le coût de la poursuite",
        description: "Revoir le moment du déclenchement et ce que cet effort laissait pour la fin de course.",
      },
      {
        id: "commend-initiative", approach: "praise", baseMorale: 1, popularityDelta: 1,
        label: "Reconnaître l’initiative au micro",
        description: "Dire que vous avez apprécié de voir le coureur prendre ses responsabilités.",
      },
    ],
  },
  {
    id: "rider-abandon-return-to-bus",
    requires: "dnf",
    rarity: "notable",
    title: "De retour plus tôt que prévu",
    story: "{{riderName}} n’a pas terminé la course. Au bus, les journalistes vous demandent un premier commentaire sur cet abandon.",
    choices: [
      {
        id: "follow-up-in-private", approach: "listen", baseMorale: 2,
        label: "Prendre le temps de l’entendre",
        description: "Écouter ce qu’il veut partager avant de tirer un bilan de la journée.",
      },
      {
        id: "state-only-the-facts", approach: "protect", baseMorale: 2,
        label: "Vous en tenir au constat public",
        description: "Confirmer l’abandon et attendre le débrief avant de parler de ses raisons.",
      },
      {
        id: "rebuild-race-sequence", approach: "analyse", baseMorale: 0,
        label: "Reconstituer sa course à froid",
        description: "Faire le point ensuite sur les moments qui ont pesé dans l’arrêt.",
      },
      {
        id: "ask-for-fast-response", approach: "challenge", baseMorale: -2,
        label: "Insister sur une réponse pour la suite",
        description: "Lui dire dès le retour au bus que vous attendez une réaction sportive au prochain rendez-vous.",
      },
    ],
  },
  {
    id: "rider-outside-time-limit-response",
    requires: "otl",
    rarity: "notable",
    title: "Le délai est passé",
    story: "{{riderName}} a terminé hors délais. Les questions portent déjà sur ce qui aurait pu être fait en course pour éviter ce résultat.",
    choices: [
      {
        id: "own-communication", approach: "accountability", baseMorale: 1,
        label: "Examiner les consignes données depuis la voiture",
        description: "Faire le point sur ce que le staff aurait pu signaler ou décider plus tôt.",
      },
      {
        id: "review-timing", approach: "analyse", baseMorale: 1,
        label: "Reprendre les écarts avec lui",
        description: "Identifier ensemble le moment où le délai est devenu difficile à tenir.",
      },
      {
        id: "shield-from-speculation", approach: "protect", baseMorale: 1,
        label: "Couper court aux spéculations",
        description: "Confirmer le classement sans exposer le coureur à des reproches à chaud.",
      },
      {
        id: "ask-for-a-response", approach: "challenge", baseMorale: -2,
        label: "Attendre une réponse au prochain départ",
        description: "Lui rappeler le niveau d’exigence que vous fixez pour les prochaines courses.",
      },
    ],
  },
  {
    id: "rider-chrono-pacing-feedback",
    requires: "individual-time-trial",
    rarity: "common",
    title: "Ce que dit le chrono",
    story: "Le temps de {{riderName}} est officiel. Le coureur vous demande ce que sa gestion de l’effort laisse entrevoir pour le prochain contre-la-montre.",
    choices: [
      {
        id: "review-pacing", approach: "analyse", baseMorale: 2,
        label: "Faire un retour sur la gestion de l’effort",
        description: "Comparer le plan de départ, les sensations et le rythme tenu jusqu’à l’arrivée.",
      },
      {
        id: "let-rider-adjust", approach: "autonomy", baseMorale: 1,
        label: "Lui laisser adapter son plan",
        description: "Fixer un point de repère commun et lui laisser l’ajuster selon ses sensations.",
      },
      {
        id: "hear-rider-first", approach: "listen", baseMorale: 1,
        label: "Lui demander où le rythme a changé",
        description: "Partir de ce qu’il a ressenti plutôt que commenter immédiatement son temps.",
      },
      {
        id: "raise-chrono-expectation", approach: "challenge", baseMorale: -1,
        label: "Fixer un objectif chronométrique plus exigeant",
        description: "Lui dire que la préparation du prochain chrono devra viser un effort mieux maîtrisé de bout en bout.",
      },
    ],
  },
  {
    id: "rider-team-chrono-relays",
    requires: "team-time-trial",
    rarity: "common",
    title: "Revenir sur les relais",
    story: "Après le contre-la-montre par équipes, {{riderName}} veut faire le point sur la façon dont le groupe a géré ses relais.",
    choices: [
      {
        id: "compare-relay-notes", approach: "collective", baseMorale: 2,
        label: "Débriefer les relais en groupe",
        description: "Faire remonter les sensations de chaque coureur et décider ensemble d’un rythme commun.",
      },
      {
        id: "review-team-chrono", approach: "analyse", baseMorale: 1,
        label: "Revoir les changements de rythme",
        description: "Identifier les passages où le groupe aurait pu mieux synchroniser ses relais.",
      },
      {
        id: "explain-team-instructions", approach: "accountability", baseMorale: 1,
        label: "Assumer vos consignes de départ",
        description: "Expliquer ce que vous garderiez et ce que vous modifieriez dans le plan de relais.",
      },
      {
        id: "designate-rhythm-lead", approach: "autonomy", baseMorale: 0,
        label: "Lui proposer de réguler un passage",
        description: "Voir avec le coureur s’il veut donner le rythme sur une portion bien définie lors d’un prochain chrono.",
      },
    ],
  },
  {
    id: "rider-low-morale-check-in",
    requires: "low-morale",
    rarity: "notable",
    title: "Prendre le temps de parler",
    story: "Après la course, {{riderName}} vient vous voir à l’écart. Il vous dit qu’il aborde les derniers débriefs avec moins de confiance.",
    choices: [
      {
        id: "private-check-in", approach: "listen", baseMorale: 2,
        label: "Ouvrir un échange en privé",
        description: "Lui demander ce qui pèse le plus et convenir d’un moment pour faire le point.",
      },
      {
        id: "remove-media-pressure", approach: "protect", baseMorale: 2,
        label: "Alléger la pression médiatique",
        description: "Prendre en charge les commentaires à chaud et laisser le coureur s’exprimer à son rythme.",
      },
      {
        id: "one-manageable-step", approach: "analyse", baseMorale: 1,
        label: "Choisir un objectif qu’il peut maîtriser",
        description: "Identifier ensemble un aspect concret sur lequel il peut reprendre confiance.",
      },
      {
        id: "press-for-a-rebound", approach: "challenge", baseMorale: -2,
        label: "Lui demander de rebondir sans attendre",
        description: "Lui dire que vous attendez une réponse sur le vélo dès sa prochaine course.",
      },
    ],
  },
  {
    id: "rider-support-after-teammate-podium",
    requires: "support-after-team-podium",
    rarity: "common",
    title: "Le travail derrière le podium",
    story: "Un coureur de {{teamName}} monte sur le podium. {{riderName}}, qui avait un rôle d’équipier dans votre plan, écoute votre bilan devant les micros.",
    choices: [
      {
        id: "credit-support-team", approach: "collective", baseMorale: 2,
        label: "Reconnaître le rôle des équipiers",
        description: "Expliquer comment le plan répartissait les responsabilités autour du coureur du podium.",
      },
      {
        id: "acknowledge-rider-by-name", approach: "praise", baseMorale: 1, popularityDelta: 1,
        label: "Remercier cet équipier devant la presse",
        description: "Nommer {{riderName}} et rappeler le rôle que vous lui aviez confié.",
      },
      {
        id: "ask-about-support-role", approach: "listen", baseMorale: 1,
        label: "Lui demander comment il a vécu son rôle",
        description: "Faire le point en tête-à-tête sur ses consignes et sa marge pour les appliquer.",
      },
      {
        id: "discuss-own-chance", approach: "autonomy", baseMorale: 0,
        label: "Parler d’une occasion de jouer sa carte",
        description: "Écouter ses envies pour une prochaine course adaptée à ses qualités.",
      },
    ],
  },
  {
    id: "rider-routine-post-race-review",
    requires: "finished",
    rarity: "common",
    title: "Le retour d’expérience",
    story: "À l’arrivée, {{riderName}} vous demande un retour sur la journée. Vous avez quelques minutes au bus pour fixer la suite du débrief.",
    choices: [
      {
        id: "ask-what-worked", approach: "listen", baseMorale: 1,
        label: "Partir de ce qui lui a semblé fonctionner",
        description: "Écouter ses sensations avant de rapprocher son récit de ce que vous avez observé.",
      },
      {
        id: "choose-one-adjustment", approach: "analyse", baseMorale: 1,
        label: "Retenir un ajustement précis",
        description: "Choisir avec lui un geste, un placement ou une consigne à revoir sur la prochaine course.",
      },
      {
        id: "give-one-decision", approach: "autonomy", baseMorale: 1,
        label: "Lui laisser proposer son prochain ajustement",
        description: "Demander au coureur ce qu’il veut essayer quand une situation similaire se présentera.",
      },
      {
        id: "bring-in-the-team", approach: "collective", baseMorale: 0,
        label: "Comparer avec les autres coureurs",
        description: "Reprendre le déroulé avec les équipiers pour affiner les consignes communes.",
      },
    ],
  },
];
