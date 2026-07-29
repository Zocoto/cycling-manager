import type { TutorialDefinition } from "@/types/tutorial";

export const TRANSFER_TUTORIAL_KEY = "transfers";
export const TRANSFER_TUTORIAL_VERSION = 1;
export const TRANSFER_DAILY_TUTORIAL_ROUTE =
  "/jeu/transferts?onglet=quotidiennes";
export const TRANSFER_DIRECTORS_TUTORIAL_ROUTE =
  "/jeu/transferts?onglet=directeurs";
export const TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE =
  "/jeu/transferts?onglet=libres";

export const transferTutorialDefinition = {
  key: TRANSFER_TUTORIAL_KEY,
  version: TRANSFER_TUTORIAL_VERSION,
  type: "contextual",
  title: "Maîtriser le Bureau des transferts",
  description:
    "Découvrez les enchères quotidiennes, les ventes entre Directeurs Sportifs et la signature des agents libres.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "transfer-overview",
      route: TRANSFER_DAILY_TUTORIAL_ROUTE,
      targetId: "transfer-overview",
      title: "Trois façons de renforcer votre effectif",
      content:
        "Le Bureau des transferts réunit tous les recrutements et toutes les ventes de coureurs. Le bandeau rappelle votre budget projeté, les sommes réservées par vos offres en tête, la trésorerie encore disponible, le niveau de votre Data Room et les places restantes dans l’effectif.\n\nLa Data Room ne révèle pas instantanément les notes réelles : elle resserre progressivement les estimations contenues dans les rapports de scouting.",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "transfer-tabs",
      route: TRANSFER_DAILY_TUTORIAL_ROUTE,
      targetId: "transfer-tabs",
      title: "Choisissez le marché adapté à votre besoin",
      content:
        "Les enchères quotidiennes proposent dix nouveaux talents pendant une journée. Les enchères des DS permettent aux équipes de vendre et d’acheter entre elles pendant 24 heures. Les agents libres peuvent être engagés immédiatement, sans indemnité de transfert.\n\nNous allons parcourir ces trois sous-rubriques dans cet ordre.",
      placement: "bottom",
      highlightPadding: 6,
    },
    {
      key: "daily-overview",
      route: TRANSFER_DAILY_TUTORIAL_ROUTE,
      targetId: "transfer-daily-overview",
      title: "Dix nouveaux profils chaque jour",
      content:
        "La sélection quotidienne ouvre à 9 h et se clôture à 18 h. Chaque arrivage contient dix coureurs générés pour ce marché ; ils commencent leur carrière avec 0 jour de course.\n\nLeur âge, leur profil et leur demande salariale sont connus, mais leurs statistiques et leur potentiel restent présentés sous forme d’estimations. Un talent particulièrement rare peut parfois apparaître.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "daily-bidding",
      route: TRANSFER_DAILY_TUTORIAL_ROUTE,
      targetId: "transfer-daily-listings",
      title: "Enchérissez en intégrant tout le coût",
      content:
        "Chaque fiche indique l’offre en tête, le prochain montant minimal, le salaire et le temps restant. Lorsque votre équipe mène, le montant de l’offre et le salaire de la saison sont réservés : ils réduisent immédiatement le budget disponible pour vos autres opérations.\n\nÀ la clôture, le plus offrant recrute automatiquement le coureur pour la saison actuelle et la suivante. Une place libre dans l’effectif et un budget suffisant restent indispensables.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "director-selling",
      route: TRANSFER_DIRECTORS_TUTORIAL_ROUTE,
      targetId: "transfer-director-selling",
      title: "Mettez un coureur en vente pendant 24 heures",
      content:
        "Sélectionnez un coureur éligible de votre effectif, fixez son prix d’appel puis publiez l’annonce. Le coureur reste dans votre équipe jusqu’à la clôture et le transfert est ensuite traité automatiquement si une offre a été déposée.\n\nUn coureur recruté pendant la saison ne peut pas être revendu avant la saison suivante. Les coureurs fondateurs restent immédiatement cessibles.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "director-market",
      route: TRANSFER_DIRECTORS_TUTORIAL_ROUTE,
      targetId: "transfer-director-market",
      title: "Achetez directement auprès des autres DS",
      content:
        "Les annonces des autres équipes fonctionnent comme les enchères quotidiennes, mais restent ouvertes pendant 24 heures. Comparez le rapport de scouting, le prix actuel, le salaire et le temps restant avant de surenchérir.\n\nVous ne pouvez pas enchérir sur votre propre vente. Si vous remportez l’enchère, les écritures financières et le changement d’équipe sont réalisés à la clôture.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "free-agents-overview",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      targetId: "transfer-free-agents-overview",
      title: "Signez sans indemnité de transfert",
      content:
        "Les coureurs sans équipe sont disponibles immédiatement : aucune enchère ni indemnité n’est nécessaire. Leur salaire est connu et leur contrat couvre la saison actuelle ainsi que la suivante.\n\nLeur niveau reste toutefois soumis à la précision du rapport de scouting. Une signature occupe immédiatement une place dans l’effectif et engage le salaire annoncé.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "free-agent-filters",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      targetId: "transfer-free-agent-filters",
      title: "Réduisez la liste aux profils utiles",
      content:
        "Combinez le profil, la nationalité, l’âge et une statistique estimée minimale pour cibler votre recherche. Le filtre de statistique peut porter sur la moyenne générale ou sur une qualité précise du coureur.\n\nComme les rapports restent imparfaits, utilisez ces seuils pour présélectionner des candidats, puis comparez leur fiche et leur coût avant de signer.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "free-agent-signing",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      targetId: "transfer-free-agent-listings",
      title: "Vérifiez l’effectif avant la signature",
      content:
        "Chaque fiche récapitule le rapport disponible et la demande salariale. Le bouton de signature est désactivé lorsque votre effectif est complet ; libérez alors une place avant de recruter.\n\nLa signature est immédiate : contrairement à une enchère, il n’existe ni délai de réflexion ni arbitrage à la clôture.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      title: "Le Bureau des transferts est maîtrisé",
      content:
        "Vous savez maintenant lire votre capacité financière, enchérir sur la sélection quotidienne, vendre ou acheter un coureur auprès d’un autre Directeur Sportif, puis filtrer et signer un agent libre.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera accessible depuis le point d’interrogation du Bureau des transferts.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
