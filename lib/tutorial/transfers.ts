import type { TutorialDefinition } from "@/types/tutorial";

export const TRANSFER_TUTORIAL_KEY = "transfers";
export const TRANSFER_TUTORIAL_VERSION = 2;
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
    "Découvrez les enchères quotidiennes, les ventes entre Directeurs Sportifs et la recherche de coureurs libres ou sous contrat.",
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
        "Les enchères quotidiennes proposent de nouveaux talents pendant une journée. Les enchères des DS permettent aux équipes de vendre et d’acheter entre elles pendant au moins 24 heures. La recherche de coureurs parcourt les profils libres ou sous contrat.\n\nNous allons parcourir ces trois sous-rubriques dans cet ordre.",
      placement: "bottom",
      highlightPadding: 6,
    },
    {
      key: "daily-overview",
      route: TRANSFER_DAILY_TUTORIAL_ROUTE,
      targetId: "transfer-daily-overview",
      title: "De nouveaux profils chaque jour",
      content:
        "La sélection quotidienne ouvre à 9 h, avec une clôture initiale à 18 h. Chaque arrivage contient une sélection de coureurs générés pour ce marché ; ils commencent leur carrière avec 0 jour de course.\n\nToute offre placée dans les 10 dernières minutes repousse la clôture de 30 minutes. Cette règle s’applique à nouveau près de chaque nouvelle échéance.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "daily-bidding",
      route: TRANSFER_DAILY_TUTORIAL_ROUTE,
      targetId: "transfer-daily-listings",
      title: "Enchérissez en intégrant tout le coût",
      content:
        "Chaque fiche indique l’offre en tête, le prochain montant minimal, le salaire et le temps restant. Lorsque votre équipe mène, le montant de l’offre est réservé et réduit le budget disponible pour vos autres opérations.\n\nUne enchère acceptée est ferme : à la clôture, le plus offrant recrute automatiquement le coureur pour la saison actuelle et la suivante. Une place libre dans l’effectif reste indispensable.",
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
        "Les annonces des autres équipes fonctionnent comme les enchères quotidiennes, avec une durée initiale de 24 heures. Comparez le rapport de scouting, le prix actuel, le salaire et le temps restant avant de surenchérir.\n\nUne offre dans les 10 dernières minutes ajoute 30 minutes. Vous ne pouvez pas enchérir sur votre propre vente ; le transfert et les écritures sont automatiques à la clôture.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "free-agents-overview",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      targetId: "transfer-free-agents-overview",
      title: "Cherchez dans toute la base",
      content:
        "Le filtre Contrat permet d’alterner entre les coureurs libres, disponibles immédiatement sans indemnité, et les coureurs déjà engagés par une équipe.\n\nPour un coureur sous contrat, ouvrez sa fiche afin de transmettre une offre directe à son Directeur Sportif. Son niveau reste soumis à la précision du rapport de scouting.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "free-agent-filters",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      targetId: "transfer-free-agent-filters",
      title: "Réduisez la liste aux profils utiles",
      content:
        "Combinez le contrat, le profil, la nationalité, l’âge et une statistique minimale pour cibler votre recherche. Le filtre de statistique peut porter sur la moyenne générale ou sur une qualité précise du coureur.\n\nLa recherche et la pagination sont traitées côté serveur : même une grande base de coureurs reste rapide à parcourir.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "free-agent-signing",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      targetId: "transfer-free-agent-listings",
      title: "Signez ou ouvrez une négociation",
      content:
        "Chaque fiche récapitule le rapport disponible et le salaire attendu. Un coureur libre peut signer immédiatement ; pour un coureur sous contrat, ouvrez sa fiche puis proposez une indemnité au DS vendeur.\n\nLe recrutement reste bloqué lorsque votre effectif est complet. Les contrôles de budget et d’éligibilité sont appliqués avant chaque offre.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      title: "Le Bureau des transferts est maîtrisé",
      content:
        "Vous savez maintenant lire votre capacité financière, enchérir sur la sélection quotidienne, vendre ou acheter un coureur auprès d’un autre Directeur Sportif, puis rechercher un profil libre ou sous contrat.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera accessible depuis le point d’interrogation du Bureau des transferts.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
