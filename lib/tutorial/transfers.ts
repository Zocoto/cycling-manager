import type { TutorialDefinition } from "@/types/tutorial";

export const TRANSFER_TUTORIAL_KEY = "transfers";
export const TRANSFER_TUTORIAL_VERSION = 3;
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
    "Découvrez les enchères réunies, la console de vente et la recherche de coureurs libres ou sous contrat.",
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
        "La rubrique Enchères réunit la sélection quotidienne, les profils des fêtes nationales et les ventes publiées par les autres DS. La rubrique Vente de coureur est désormais une console réservée à vos propres annonces. La recherche de coureurs parcourt les profils libres ou sous contrat.\n\nNous allons parcourir ces trois sous-rubriques dans cet ordre.",
      placement: "bottom",
      highlightPadding: 6,
    },
    {
      key: "daily-overview",
      route: TRANSFER_DAILY_TUTORIAL_ROUTE,
      targetId: "transfer-daily-overview",
      title: "Toutes les enchères au même endroit",
      content:
        "La sélection quotidienne ouvre à 9 h, avec une clôture initiale à 18 h. Les enchères DS apparaissent dans la même liste pour 24 heures, avec un libellé qui permet d’identifier immédiatement leur origine.\n\nToute offre placée dans les 10 dernières minutes repousse la clôture de 30 minutes. Cette règle s’applique à nouveau près de chaque nouvelle échéance.",
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
        "Parcourez votre liste de valeur, sélectionnez un coureur puis contrôlez ses notes exactes dans la tuile de traitement. Fixez son prix d’appel et confirmez : l’annonce rejoint immédiatement la rubrique Enchères pour 24 heures.\n\nUn coureur recruté pendant la saison ne peut pas être revendu avant la saison suivante. Les coureurs fondateurs restent immédiatement cessibles.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "director-market",
      route: TRANSFER_DIRECTORS_TUTORIAL_ROUTE,
      targetId: "transfer-director-market",
      title: "Suivez vos coureurs en vente",
      content:
        "Le listing situé sous la console affiche uniquement vos annonces actives, l’offre en tête et le temps restant. Les acheteurs retrouvent ces mêmes coureurs dans la rubrique Enchères.\n\nLe coureur reste dans votre équipe jusqu’à la clôture ; le transfert et les écritures financières sont automatiques si une offre a été déposée.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "free-agents-overview",
      route: TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
      targetId: "transfer-free-agents-overview",
      title: "Cherchez dans toute la base",
      content:
        "Le filtre Contrat permet d’afficher tous les coureurs, uniquement les coureurs libres disponibles immédiatement sans indemnité, ou uniquement ceux déjà engagés par une équipe.\n\nPour un coureur sous contrat, ouvrez sa fiche afin de transmettre une offre directe à son Directeur Sportif. Son niveau reste soumis à la précision du rapport de scouting.",
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
        "Vous savez maintenant lire votre capacité financière, enchérir sur toutes les annonces réunies, publier et suivre une vente, puis rechercher un profil libre ou sous contrat.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera accessible depuis le point d’interrogation du Bureau des transferts.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
