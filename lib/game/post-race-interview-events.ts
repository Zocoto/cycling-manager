import type {
  PostRaceInterviewContext,
  ZoneMixteEvent,
  ZoneMixteEventRarity,
} from "@/lib/game/post-race-interview";

export type {
  ZoneMixteEvent,
  ZoneMixteEventChoice,
  ZoneMixteEventOutcome,
  ZoneMixteEventRarity,
  ZoneMixteEventRisk,
} from "@/lib/game/post-race-interview";

type EventRequirement = "sponsor" | "rivalry" | "chase" | "podium";

type ZoneMixteEventDefinition = ZoneMixteEvent & {
  requires?: EventRequirement;
};

const EVENT_DEFINITIONS: readonly ZoneMixteEventDefinition[] = [
  {
    id: "open-micro",
    rarity: "common",
    title: "Le micro était encore ouvert",
    story:
      "Une remarque de {{directorName}}, destinée au seul staff, vient de partir en direct dans toute la zone mixte.",
    choices: [
      {
        id: "apologize",
        label: "Présenter des excuses",
        description: "Une prise de parole sobre pour refermer immédiatement l’incident.",
        impactPreview: "+1 réputation",
        risk: "safe",
        outcomes: [
          { weight: 100, reputationDelta: 1, summary: "Les excuses franches ont été appréciées : +1 réputation." },
        ],
      },
      {
        id: "own-the-joke",
        label: "Assumer avec humour",
        description: "Transformer la gaffe en séquence virale, au risque d’en faire un peu trop.",
        impactPreview: "70 % : +1 réputation et +2 popularité · 30 % : −1 réputation et +3 popularité",
        risk: "bold",
        outcomes: [
          { weight: 70, reputationDelta: 1, riderPopularityDelta: 2, summary: "La répartie a fait rire sans choquer : +1 réputation et +2 popularité." },
          { weight: 30, reputationDelta: -1, riderPopularityDelta: 3, summary: "La formule divise, mais elle devient virale : −1 réputation et +3 popularité." },
        ],
      },
    ],
  },
  {
    id: "mispronounced-rider",
    rarity: "common",
    title: "Un nom proprement massacré",
    story:
      "Après trois tentatives, le journaliste n’est toujours pas parvenu à prononcer le nom de {{riderName}}.",
    choices: [
      {
        id: "gentle-correction",
        label: "Le corriger gentiment",
        description: "Rendre son vrai nom au coureur sans humilier le journaliste.",
        impactPreview: "+1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, summary: "La correction élégante est saluée : +1 réputation." }],
      },
      {
        id: "invent-nickname",
        label: "Lui inventer un surnom",
        description: "Faire de l’erreur un nouveau surnom de supporters.",
        impactPreview: "80 % : +3 popularité · 20 % : −1 réputation et +3 popularité",
        risk: "balanced",
        outcomes: [
          { weight: 80, riderPopularityDelta: 3, summary: "Le surnom est immédiatement adopté : +3 popularité." },
          { weight: 20, reputationDelta: -1, riderPopularityDelta: 3, summary: "Le surnom plaît aux fans mais agace les puristes : −1 réputation et +3 popularité." },
        ],
      },
    ],
  },
  {
    id: "discarded-bottle",
    rarity: "common",
    title: "Le bidon qui ne devait pas être là",
    story:
      "Une photo montre un bidon de {{teamName}} abandonné bien au-delà de la zone de collecte.",
    choices: [
      {
        id: "fund-cleanup",
        label: "Financer le nettoyage",
        description: "Prendre immédiatement en charge une opération locale de ramassage.",
        impactPreview: "−1 200 € et +1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -1200, reputationDelta: 1, summary: "L’opération de nettoyage coûte 1 200 € et rapporte +1 réputation." }],
      },
      {
        id: "rider-apology",
        label: "Faire témoigner le coureur",
        description: "{{riderName}} présente personnellement ses excuses.",
        impactPreview: "+1 réputation et −1 popularité",
        risk: "balanced",
        outcomes: [{ weight: 100, reputationDelta: 1, riderPopularityDelta: -1, summary: "Les excuses sont crédibles, mais le coureur perd un peu de son aura : +1 réputation et −1 popularité." }],
      },
    ],
  },
  {
    id: "young-fan-souvenir",
    rarity: "common",
    title: "Un bidon pour un petit fan",
    story:
      "Un jeune supporter de {{riderName}} s’est faufilé jusqu’à la barrière avec une demande très précise : repartir avec un souvenir.",
    choices: [
      {
        id: "signed-bottle",
        label: "Offrir un bidon signé",
        description: "Préparer un vrai souvenir au nom du jeune supporter.",
        impactPreview: "−200 €, +1 réputation et +2 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -200, reputationDelta: 1, riderPopularityDelta: 2, summary: "Le geste fait mouche : −200 €, +1 réputation et +2 popularité." }],
      },
      {
        id: "photo",
        label: "Improviser une photo",
        description: "Une photo avec le coureur, simple et immédiate.",
        impactPreview: "+1 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, riderPopularityDelta: 1, summary: "La photo fait un heureux : +1 popularité." }],
      },
    ],
  },
  {
    id: "wheel-sucker",
    rarity: "common",
    requires: "rivalry",
    title: "« Suceur de roue ! »",
    story:
      "Un rival accuse {{riderName}} d’avoir passé la journée bien au chaud avant de surgir au dernier moment.",
    choices: [
      {
        id: "praise-rival",
        label: "Saluer le rival",
        description: "Désamorcer la polémique en reconnaissant la qualité de l’adversaire.",
        impactPreview: "+1 réputation et +1 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, riderPopularityDelta: 1, summary: "La réponse sportive apaise tout le monde : +1 réputation et +1 popularité." }],
      },
      {
        id: "counterattack",
        label: "Répliquer sèchement",
        description: "Rappeler qu’une roue se prend encore faut-il savoir la suivre.",
        impactPreview: "60 % : +1 réputation et +3 popularité · 40 % : −2 réputation et +3 popularité",
        risk: "bold",
        outcomes: [
          { weight: 60, reputationDelta: 1, riderPopularityDelta: 3, summary: "La pique est jugée brillante : +1 réputation et +3 popularité." },
          { weight: 40, reputationDelta: -2, riderPopularityDelta: 3, summary: "La tension monte, mais les supporters adorent : −2 réputation et +3 popularité." },
        ],
      },
    ],
  },
  {
    id: "chase-potato-meme",
    rarity: "common",
    requires: "chase",
    title: "La chasse-patate fait le tour du réseau",
    story:
      "La poursuite solitaire de {{riderName}} est déjà montée sur une musique dramatique et partagée partout.",
    choices: [
      {
        id: "embrace-meme",
        label: "Jouer le jeu",
        description: "Publier la vidéo depuis le compte officiel de l’équipe.",
        impactPreview: "+3 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, riderPopularityDelta: 3, summary: "Le coureur devient le héros du jour : +3 popularité." }],
      },
      {
        id: "tactical-defense",
        label: "Défendre la tactique",
        description: "Expliquer calmement pourquoi cette poursuite avait du sens.",
        impactPreview: "+1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, summary: "L’analyse convainc les observateurs : +1 réputation." }],
      },
    ],
  },
  {
    id: "competitor-gel",
    rarity: "common",
    requires: "sponsor",
    title: "Le gel du concurrent",
    story:
      "Une photo très nette montre {{riderName}} avec un produit concurrent de {{sponsorName}} entre les dents.",
    choices: [
      {
        id: "sponsor-apology",
        label: "Présenter des excuses au sponsor",
        description: "Organiser immédiatement un nouveau contenu aux couleurs de {{sponsorName}}.",
        impactPreview: "−1 000 € et +1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -1000, reputationDelta: 1, summary: "La réparation commerciale coûte 1 000 € et rapporte +1 réputation." }],
      },
      {
        id: "blind-tasting",
        label: "Lancer une dégustation à l’aveugle",
        description: "Faire de la bourde une séquence volontairement absurde.",
        impactPreview: "60 % : +3 popularité · 40 % : −1 réputation et +2 popularité",
        risk: "bold",
        outcomes: [
          { weight: 60, riderPopularityDelta: 3, summary: "La séquence devient un succès : +3 popularité." },
          { weight: 40, reputationDelta: -1, riderPopularityDelta: 2, summary: "Le sponsor goûte peu la plaisanterie : −1 réputation et +2 popularité." },
        ],
      },
    ],
  },
  {
    id: "banner-typo",
    rarity: "common",
    title: "La banderole presque parfaite",
    story:
      "Des supporters ont confectionné une magnifique banderole pour {{riderName}}, avec une faute gigantesque au milieu.",
    choices: [
      {
        id: "pose-with-banner",
        label: "Poser fièrement devant",
        description: "Considérer que l’intention compte davantage que l’orthographe.",
        impactPreview: "+1 réputation et +2 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, riderPopularityDelta: 2, summary: "La photo attendrit le public : +1 réputation et +2 popularité." }],
      },
      {
        id: "fund-reprint",
        label: "Financer une nouvelle banderole",
        description: "Offrir aux supporters une version corrigée pour la prochaine course.",
        impactPreview: "−800 € et +1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -800, reputationDelta: 1, summary: "La nouvelle banderole coûte 800 € et rapporte +1 réputation." }],
      },
    ],
  },
  {
    id: "wrong-rider-congratulated",
    rarity: "common",
    title: "Ce n’était pas lui",
    story:
      "Un journaliste félicite longuement {{riderName}} pour une action réalisée par un autre coureur de {{teamName}}.",
    choices: [
      {
        id: "restore-credit",
        label: "Rendre le mérite au bon coureur",
        description: "Corriger immédiatement le récit et valoriser le collectif.",
        impactPreview: "+1 réputation et +2 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, riderPopularityDelta: 2, summary: "L’honnêteté et l’esprit collectif sont salués : +1 réputation et +2 popularité." }],
      },
      {
        id: "play-along",
        label: "Entretenir la confusion",
        description: "Laisser le coureur improviser comme s’il y était vraiment.",
        impactPreview: "−1 réputation et +3 popularité",
        risk: "bold",
        outcomes: [{ weight: 100, reputationDelta: -1, riderPopularityDelta: 3, summary: "La scène amuse beaucoup mais manque d’élégance : −1 réputation et +3 popularité." }],
      },
    ],
  },
  {
    id: "local-specialty",
    rarity: "common",
    title: "Une spécialité locale taille peloton",
    story:
      "Les organisateurs arrivent avec {{localSpecialty}} aux proportions déraisonnables et cherchent une équipe pour l’accueillir.",
    choices: [
      {
        id: "share-public",
        label: "Partager avec le public",
        description: "Installer une dégustation improvisée devant le bus.",
        impactPreview: "−500 €, +1 réputation et +2 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -500, reputationDelta: 1, riderPopularityDelta: 2, summary: "La dégustation coûte 500 € et rapporte +1 réputation et +2 popularité." }],
      },
      {
        id: "charity-auction",
        label: "Organiser une vente caritative",
        description: "Mettre la pièce géante aux enchères au profit d’un club local.",
        impactPreview: "−1 000 € et +2 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -1000, reputationDelta: 2, summary: "L’opération coûte 1 000 € et rapporte +2 réputation." }],
      },
    ],
  },
  {
    id: "stuck-horn",
    rarity: "common",
    title: "Le klaxon refuse de se taire",
    story:
      "La voiture de {{teamName}} traverse la zone mixte avec un klaxon bloqué sur une note particulièrement autoritaire.",
    choices: [
      {
        id: "make-joke",
        label: "En faire une blague",
        description: "Prétendre qu’il s’agit du nouvel hymne officiel de l’équipe.",
        impactPreview: "80 % : +2 popularité · 20 % : −1 réputation et +2 popularité",
        risk: "balanced",
        outcomes: [
          { weight: 80, riderPopularityDelta: 2, summary: "La panne amuse la galerie : +2 popularité." },
          { weight: 20, reputationDelta: -1, riderPopularityDelta: 2, summary: "L’organisation rit moins que les supporters : −1 réputation et +2 popularité." },
        ],
      },
      {
        id: "reimburse-organizer",
        label: "Indemniser l’organisation",
        description: "Prendre en charge les désagréments causés autour du podium.",
        impactPreview: "−1 500 € et +1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -1500, reputationDelta: 1, summary: "Le geste coûte 1 500 € et rapporte +1 réputation." }],
      },
    ],
  },
  {
    id: "chalk-name-typo",
    rarity: "common",
    title: "Même la route écorche son nom",
    story:
      "Le nom de {{riderName}} a été peint en lettres immenses sur la chaussée, mais pas tout à fait dans le bon ordre.",
    choices: [
      {
        id: "sign-correction",
        label: "Signer la correction",
        description: "Ajouter une flèche et une signature à côté de la faute.",
        impactPreview: "+2 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, riderPopularityDelta: 2, summary: "La correction devient une photo culte : +2 popularité." }],
      },
      {
        id: "fan-contest",
        label: "Lancer un concours de supporters",
        description: "Récompenser la meilleure nouvelle inscription lors de la prochaine course.",
        impactPreview: "−500 €, +1 réputation et +1 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -500, reputationDelta: 1, riderPopularityDelta: 1, summary: "Le concours coûte 500 € et rapporte +1 réputation et +1 popularité." }],
      },
    ],
  },
  {
    id: "sticky-bottle-video",
    rarity: "notable",
    title: "Le bidon était vraiment très collant",
    story:
      "Une vidéo au ralenti montre une transmission de bidon qui semble avoir duré une éternité.",
    choices: [
      {
        id: "acknowledge",
        label: "Reconnaître le geste",
        description: "Admettre une limite franchie dans le feu de l’action.",
        impactPreview: "−1 réputation et +1 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: -1, riderPopularityDelta: 1, summary: "La franchise limite les dégâts : −1 réputation et +1 popularité." }],
      },
      {
        id: "deny",
        label: "Contester l’interprétation",
        description: "Soutenir que le ralenti déforme totalement la scène.",
        impactPreview: "40 % : +1 réputation · 60 % : −2 réputation",
        risk: "bold",
        outcomes: [
          { weight: 40, reputationDelta: 1, summary: "Un autre angle de caméra vous donne raison : +1 réputation." },
          { weight: 60, reputationDelta: -2, summary: "Une deuxième vidéo ruine la défense : −2 réputation." },
        ],
      },
    ],
  },
  {
    id: "public-tactics-criticism",
    rarity: "notable",
    title: "Le coureur critique la tactique",
    story:
      "À peine descendu du vélo, {{riderName}} déclare qu’il aurait préféré courir très différemment.",
    choices: [
      {
        id: "collective-responsibility",
        label: "Assumer collectivement",
        description: "Reconnaître que le plan pouvait être meilleur sans désigner de responsable.",
        impactPreview: "+1 réputation et +1 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, riderPopularityDelta: 1, summary: "La réponse rassemble l’équipe : +1 réputation et +1 popularité." }],
      },
      {
        id: "protect-rider",
        label: "Défendre totalement le coureur",
        description: "Prendre sur soi et reconnaître publiquement une erreur personnelle.",
        impactPreview: "−1 réputation et +4 popularité",
        risk: "balanced",
        outcomes: [{ weight: 100, reputationDelta: -1, riderPopularityDelta: 4, summary: "Le coureur sort grandi, le DS un peu moins : −1 réputation et +4 popularité." }],
      },
    ],
  },
  {
    id: "sponsor-slogan",
    rarity: "notable",
    requires: "sponsor",
    title: "Le slogan impossible de {{sponsorName}}",
    story:
      "Le sponsor demande à {{riderName}} de réciter en direct une formule publicitaire que personne n’oserait écrire sur un bidon.",
    choices: [
      {
        id: "recite-slogan",
        label: "Réciter le slogan",
        description: "Jouer le jeu commercial jusqu’au bout.",
        impactPreview: "+5 000 € et −3 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: 5000, riderPopularityDelta: -3, summary: "Le sponsor verse 5 000 €, mais la séquence coûte −3 popularité." }],
      },
      {
        id: "improvise",
        label: "Improviser une autre formule",
        description: "Tenter de sauver l’honneur du coureur et la visibilité du sponsor.",
        impactPreview: "60 % : +1 réputation et +3 popularité · 40 % : −1 réputation et +1 popularité",
        risk: "bold",
        outcomes: [
          { weight: 60, reputationDelta: 1, riderPopularityDelta: 3, summary: "L’improvisation devient la vraie campagne : +1 réputation et +3 popularité." },
          { weight: 40, reputationDelta: -1, riderPopularityDelta: 1, summary: "Le sponsor est perplexe, les fans un peu moins : −1 réputation et +1 popularité." },
        ],
      },
    ],
  },
  {
    id: "local-charity",
    rarity: "notable",
    title: "L’association locale tend la main",
    story:
      "Une association cycliste locale sollicite {{teamName}} devant les caméras pour soutenir son prochain projet.",
    choices: [
      {
        id: "donate",
        label: "Faire un don",
        description: "Financer directement une partie du projet.",
        impactPreview: "−5 000 €, +2 réputation et +2 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -5000, reputationDelta: 2, riderPopularityDelta: 2, summary: "Le don coûte 5 000 € et rapporte +2 réputation et +2 popularité." }],
      },
      {
        id: "send-rider",
        label: "Envoyer le coureur",
        description: "Organiser une rencontre et une séance de vélo avec {{riderName}}.",
        impactPreview: "−1 000 €, +1 réputation et +4 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -1000, reputationDelta: 1, riderPopularityDelta: 4, summary: "La rencontre coûte 1 000 € et rapporte +1 réputation et +4 popularité." }],
      },
    ],
  },
  {
    id: "swapped-musette",
    rarity: "notable",
    title: "La mauvaise musette",
    story:
      "Une musette de {{teamName}} a été échangée avec celle d’une équipe rivale. Elle revient encore fermée.",
    choices: [
      {
        id: "return-unopened",
        label: "La restituer intacte",
        description: "Faire remettre la musette sans même regarder son contenu.",
        impactPreview: "+2 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 2, summary: "Le fair-play est unanimement salué : +2 réputation." }],
      },
      {
        id: "souvenir-swap",
        label: "Proposer un échange de souvenirs",
        description: "Transformer l’erreur en troc amical entre équipes.",
        impactPreview: "70 % : Module explosivité · 30 % : −1 réputation",
        risk: "balanced",
        outcomes: [
          { weight: 70, inventoryItemKey: "acceleration-focus", inventoryItemName: "Module explosivité", summary: "L’échange vous rapporte un Module explosivité." },
          { weight: 30, reputationDelta: -1, summary: "L’équipe rivale juge l’idée déplacée : −1 réputation." },
        ],
      },
    ],
  },
  {
    id: "artisan-prototype",
    rarity: "notable",
    title: "Le prototype de l’artisan local",
    story:
      "Un artisan présente un petit appareil d’entraînement fait main. Il est étrange, mais il a manifestement travaillé toute la nuit.",
    choices: [
      {
        id: "buy-prototype",
        label: "Acheter le prototype",
        description: "Soutenir l’artisan et ramener son module au siège.",
        impactPreview: "−6 000 € et un Module explosivité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -6000, inventoryItemKey: "acceleration-focus", inventoryItemName: "Module explosivité", summary: "Le prototype coûte 6 000 € et devient un Module explosivité utilisable." }],
      },
      {
        id: "promote-artisan",
        label: "Promouvoir l’artisan",
        description: "Lui offrir la visibilité de l’équipe sans acheter l’appareil.",
        impactPreview: "+1 réputation et +2 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, riderPopularityDelta: 2, summary: "Le portrait de l’artisan touche le public : +1 réputation et +2 popularité." }],
      },
    ],
  },
  {
    id: "podium-cork",
    rarity: "notable",
    requires: "podium",
    title: "Le bouchon frappe la presse",
    story:
      "Un bouchon parti du podium vient de toucher un journaliste en pleine prise d’antenne.",
    choices: [
      {
        id: "pay-cleaning",
        label: "Présenter des excuses",
        description: "Prendre en charge le nettoyage et les petits dégâts.",
        impactPreview: "−1 500 € et +1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -1500, reputationDelta: 1, summary: "Les excuses et le nettoyage coûtent 1 500 € et rapportent +1 réputation." }],
      },
      {
        id: "laugh-together",
        label: "En rire avec lui",
        description: "Inviter le journaliste à rejouer la scène devant les caméras.",
        impactPreview: "60 % : +3 popularité · 40 % : −2 réputation et +3 popularité",
        risk: "bold",
        outcomes: [
          { weight: 60, riderPopularityDelta: 3, summary: "Le journaliste joue le jeu : +3 popularité." },
          { weight: 40, reputationDelta: -2, riderPopularityDelta: 3, summary: "La plaisanterie est mal reçue : −2 réputation et +3 popularité." },
        ],
      },
    ],
  },
  {
    id: "dangerous-sprint-claim",
    rarity: "notable",
    requires: "rivalry",
    title: "Le sprint était-il dangereux ?",
    story:
      "Un rival affirme que {{riderName}} a changé de ligne et réclame une réaction immédiate de {{directorName}}.",
    choices: [
      {
        id: "calm-response",
        label: "Apaiser le jeu",
        description: "Rappeler que les commissaires disposent des images et respecter leur décision.",
        impactPreview: "+1 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 1, summary: "La retenue est appréciée : +1 réputation." }],
      },
      {
        id: "demand-video",
        label: "Réclamer la vidéo",
        description: "Défendre fermement le coureur en demandant une diffusion immédiate des images.",
        impactPreview: "55 % : +1 réputation et +2 popularité · 45 % : −2 réputation et +1 popularité",
        risk: "bold",
        outcomes: [
          { weight: 55, reputationDelta: 1, riderPopularityDelta: 2, summary: "Les images innocentent le coureur : +1 réputation et +2 popularité." },
          { weight: 45, reputationDelta: -2, riderPopularityDelta: 1, summary: "Les images sont moins favorables que prévu : −2 réputation et +1 popularité." },
        ],
      },
    ],
  },
  {
    id: "lost-young-fan",
    rarity: "rare",
    title: "Un jeune fan cherche son groupe",
    story:
      "L’organisation a pris en charge un jeune supporter séparé de son groupe près du bus de {{teamName}} et demande un coup de main à l’équipe.",
    choices: [
      {
        id: "help-reunion",
        label: "Participer aux recherches",
        description: "Mobiliser discrètement quelques membres du staff jusqu’aux retrouvailles.",
        impactPreview: "+3 réputation et +3 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 3, riderPopularityDelta: 3, summary: "Le groupe est retrouvé et le geste marque les esprits : +3 réputation et +3 popularité." }],
      },
      {
        id: "vip-welcome",
        label: "Préparer un accueil VIP",
        description: "Ajouter une visite du bus et un maillot signé après les retrouvailles.",
        impactPreview: "−3 000 €, +2 réputation et +5 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, cashDelta: -3000, reputationDelta: 2, riderPopularityDelta: 5, summary: "L’accueil coûte 3 000 € et rapporte +2 réputation et +5 popularité." }],
      },
    ],
  },
  {
    id: "roller-challenge",
    rarity: "rare",
    title: "Le défi sur rouleaux",
    story:
      "Un influenceur installe deux vélos devant les caméras et défie {{teamName}} sur un sprint de trente secondes.",
    choices: [
      {
        id: "send-rider",
        label: "Envoyer le coureur",
        description: "Confier le défi à {{riderName}} malgré la fatigue de la course.",
        impactPreview: "60 % : +1 réputation et +5 popularité · 40 % : −3 popularité",
        risk: "balanced",
        outcomes: [
          { weight: 60, reputationDelta: 1, riderPopularityDelta: 5, summary: "Le coureur remporte le défi : +1 réputation et +5 popularité." },
          { weight: 40, riderPopularityDelta: -3, summary: "Les jambes ne répondent plus et la vidéo tourne en boucle : −3 popularité." },
        ],
      },
      {
        id: "director-rides",
        label: "Le DS relève le défi",
        description: "{{directorName}} monte lui-même sur le vélo, costume compris.",
        impactPreview: "70 % : +2 réputation et +3 popularité · 30 % : −2 réputation et +4 popularité",
        risk: "bold",
        outcomes: [
          { weight: 70, reputationDelta: 2, riderPopularityDelta: 3, summary: "La performance surprend tout le monde : +2 réputation et +3 popularité." },
          { weight: 30, reputationDelta: -2, riderPopularityDelta: 4, summary: "La chute est sans gravité et immédiatement culte : −2 réputation et +4 popularité." },
        ],
      },
    ],
  },
  {
    id: "vintage-musette",
    rarity: "rare",
    title: "La musette vintage anonyme",
    story:
      "Un paquet sans expéditeur, emballé dans un vieux journal cycliste, attend devant le bus de {{teamName}}.",
    choices: [
      {
        id: "open-parcel",
        label: "Ouvrir le paquet",
        description: "Accepter le mystère et vérifier ce que contient la musette.",
        impactPreview: "65 % : Module explosivité · 35 % : −4 000 €",
        risk: "bold",
        outcomes: [
          { weight: 65, inventoryItemKey: "acceleration-focus", inventoryItemName: "Module explosivité", summary: "La musette contient un Module explosivité parfaitement utilisable." },
          { weight: 35, cashDelta: -4000, summary: "Le colis cache une fausse facture particulièrement crédible : −4 000 €." },
        ],
      },
      {
        id: "donate-museum",
        label: "La confier au musée local",
        description: "Ne rien ouvrir et transmettre le paquet à une institution cycliste.",
        impactPreview: "+3 réputation",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 3, summary: "Le musée remercie publiquement l’équipe : +3 réputation." }],
      },
    ],
  },
  {
    id: "honorary-goat",
    rarity: "rare",
    title: "Une chèvre comme mascotte honoraire",
    story:
      "Le maire remet officiellement à {{teamName}} une chèvre locale, ruban aux couleurs de la course compris.",
    choices: [
      {
        id: "adopt-goat",
        label: "L’adopter pour la journée",
        description: "Prévoir le transport, la nourriture et une séance photo avec {{riderName}}.",
        impactPreview: "75 % : −2 000 € et +4 popularité · 25 % : −2 000 €, −1 réputation et +4 popularité",
        risk: "balanced",
        outcomes: [
          { weight: 75, cashDelta: -2000, riderPopularityDelta: 4, summary: "La mascotte conquiert le public : −2 000 € et +4 popularité." },
          { weight: 25, cashDelta: -2000, reputationDelta: -1, riderPopularityDelta: 4, summary: "La chèvre mange le micro en direct : −2 000 €, −1 réputation et +4 popularité." },
        ],
      },
      {
        id: "local-club",
        label: "La confier au club local",
        description: "Faire de la chèvre la mascotte permanente de l’école de cyclisme.",
        impactPreview: "+2 réputation et +1 popularité",
        risk: "safe",
        outcomes: [{ weight: 100, reputationDelta: 2, riderPopularityDelta: 1, summary: "Le club local adopte sa nouvelle mascotte : +2 réputation et +1 popularité." }],
      },
    ],
  },
];

export const ZONE_MIXTE_EVENT_DEFINITIONS = EVENT_DEFINITIONS;

export function selectZoneMixteEvent({
  context,
  seed,
  usedEventIds = [],
}: {
  context: PostRaceInterviewContext;
  seed: string;
  usedEventIds?: readonly string[];
}): ZoneMixteEvent | null {
  if (seededIndex(`${seed}:event-trigger`, 6) !== 0) return null;

  const used = new Set(usedEventIds);
  const eligible = EVENT_DEFINITIONS.filter(
    (event) => !used.has(event.id) && meetsRequirement(event, context),
  );
  if (eligible.length === 0) return null;

  const rarityRoll = seededIndex(`${seed}:event-rarity`, 100);
  const rarity: ZoneMixteEventRarity =
    rarityRoll < 65 ? "common" : rarityRoll < 93 ? "notable" : "rare";
  const rarityCandidates = eligible.filter((event) => event.rarity === rarity);
  const candidates = rarityCandidates.length > 0 ? rarityCandidates : eligible;
  const selected = candidates[seededIndex(`${seed}:event-choice`, candidates.length)];
  return renderEvent(selected, context);
}

function meetsRequirement(
  event: ZoneMixteEventDefinition,
  context: PostRaceInterviewContext,
) {
  if (event.requires === "sponsor") return Boolean(context.sponsorName);
  if (event.requires === "rivalry") return Boolean(context.rivalry);
  if (event.requires === "chase") return context.tookChase;
  if (event.requires === "podium") {
    return context.bestRank !== null && context.bestRank <= 3;
  }
  return true;
}

function renderEvent(
  definition: ZoneMixteEventDefinition,
  context: PostRaceInterviewContext,
): ZoneMixteEvent {
  const values: Record<string, string> = {
    teamName: context.teamName,
    riderName: context.riderName,
    directorName: context.directorName,
    sponsorName: context.sponsorName ?? "votre sponsor",
    localSpecialty: getLocalSpecialty(context.raceCountryCode),
  };
  const render = (value: string) =>
    value.replace(/{{(\w+)}}/g, (_match, key: string) => values[key] ?? "");

  return {
    id: definition.id,
    rarity: definition.rarity,
    title: render(definition.title),
    story: render(definition.story),
    choices: definition.choices.map((choice) => ({
      ...choice,
      label: render(choice.label),
      description: render(choice.description),
      outcomes: choice.outcomes.map((outcome) => ({
        ...outcome,
        summary: render(outcome.summary),
      })),
    })),
  };
}

function getLocalSpecialty(countryCode?: string | null) {
  const specialties: Record<string, string> = {
    BE: "une gaufre géante",
    CH: "une meule de fromage géante",
    DE: "un bretzel géant",
    DK: "une montagne de roulés à la cannelle",
    ES: "une tortilla géante",
    FR: "une meule de fromage géante",
    GB: "un pudding géant",
    IE: "un soda bread géant",
    IT: "un tiramisu géant",
    LU: "une tarte aux quetsches géante",
    NL: "un stroopwafel géant",
    NO: "une pile de gaufres norvégiennes",
    PT: "un pastel de nata géant",
  };
  return specialties[countryCode ?? ""] ?? "une spécialité locale géante";
}

function seededIndex(seed: string, length: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, length);
}
