import type { TutorialDefinition } from "@/types/tutorial";

export const SPONSORING_TUTORIAL_KEY = "sponsoring";
export const SPONSORING_TUTORIAL_VERSION = 1;
export const SPONSORING_TUTORIAL_ROUTE = "/jeu/sponsoring";

export const sponsoringTutorialDefinition = {
  key: SPONSORING_TUTORIAL_KEY,
  version: SPONSORING_TUTORIAL_VERSION,
  type: "contextual",
  title: "Comprendre le sponsoring",
  description:
    "Relisez en quelques étapes les offres, les engagements et le suivi de votre partenaire.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "sponsoring-overview",
      route: SPONSORING_TUTORIAL_ROUTE,
      targetId: "sponsoring-overview",
      title: "Votre situation détermine l’écran",
      content:
        "Cette rubrique évolue avec votre carrière : elle affiche d’abord le seuil de réputation, puis les offres disponibles, le choix du maillot et enfin le contrat actif.\n\nLe bloc d’introduction résume toujours la prochaine décision utile.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "sponsoring-offers",
      route: SPONSORING_TUTORIAL_ROUTE,
      targetId: "sponsoring-offers",
      title: "Comparez l’argent aux exigences",
      content:
        "Une offre se lit dans son ensemble : budget annuel, durée, prestige, philosophie et objectifs. Plus le financement et la réputation du sponsor sont élevés, plus ses attentes sont ambitieuses.\n\nUne offre absente aujourd’hui n’empêche pas ce guide : revenez à cette étape lorsque de nouvelles propositions apparaissent.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "sponsoring-objectives",
      route: SPONSORING_TUTORIAL_ROUTE,
      targetId: "sponsoring-objectives",
      title: "Suivez chaque engagement pendant la saison",
      content:
        "Après la signature, chaque objectif affiche son état et son poids dans la satisfaction du partenaire. Les objectifs de nationalité indiquent également le pourcentage actuel de votre effectif.\n\nLes courses concernées sont signalées par un point d’exclamation violet dans le calendrier.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: SPONSORING_TUTORIAL_ROUTE,
      title: "Votre partenariat est lisible",
      content:
        "Vous savez maintenant comparer les propositions et suivre les engagements d’un contrat actif.\n\nCliquez sur « Terminer » : ce court didacticiel restera accessible depuis le point d’interrogation de la rubrique Sponsoring.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
