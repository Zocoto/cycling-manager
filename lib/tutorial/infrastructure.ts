import {
  INFRASTRUCTURE_UNLOCK_LEVEL,
  MAX_INTERNATIONAL_CENTER_BONUS_PERCENTAGE,
} from "@/lib/game/infrastructure";
import type { TutorialDefinition } from "@/types/tutorial";

export const INFRASTRUCTURE_TUTORIAL_KEY = "infrastructure";
export const INFRASTRUCTURE_TUTORIAL_VERSION = 1;
export const INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE =
  "/jeu/infrastructures?onglet=batiments";
export const INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE =
  "/jeu/infrastructures?onglet=international";

export const infrastructureTutorialDefinition = {
  key: INFRASTRUCTURE_TUTORIAL_KEY,
  version: INFRASTRUCTURE_TUTORIAL_VERSION,
  type: "contextual",
  title: "Développer ses infrastructures",
  description:
    "Découvrez les bâtiments actifs, la gestion des chantiers et l’effet mondial des écoles de cyclisme.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "infrastructure-overview",
      route: INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
      targetId: "infrastructure-overview",
      title: "Des investissements durables et coûteux",
      content: `Les infrastructures suivent votre équipe au fil des saisons. Leur construction est réservée aux Directeurs Sportifs de niveau ${INFRASTRUCTURE_UNLOCK_LEVEL} ou plus et engage une part importante de la trésorerie.\n\nLe bandeau résume votre solde, les architectes disponibles, le chantier actif et le niveau de l’Académie des métiers.`,
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "construction-rules",
      route: INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
      targetId: "infrastructure-construction-status",
      title: "Un seul chantier peut avancer à la fois",
      content:
        "Une construction bloque tout autre projet jusqu’à sa livraison. Son coût est débité au lancement et son délai est exprimé en jours de jeu.\n\nUn architecte est facultatif, mais sa spécialité et son niveau peuvent réduire le coût, la durée, ou les deux. Le bâtiment ne produit son nouvel effet qu’une fois le chantier terminé.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "infrastructure-tabs",
      route: INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
      targetId: "infrastructure-tabs",
      title: "Deux familles complémentaires",
      content:
        "La vue « Bâtiments de l’équipe » rassemble la Data Room et l’Académie des métiers, dont les effets sont propres à votre structure. La vue « École internationale » présente un réseau mondial auquel toutes les équipes peuvent contribuer.\n\nNous commençons par les bâtiments internes avant d’ouvrir automatiquement la carte des écoles.",
      placement: "bottom",
      highlightPadding: 6,
    },
    {
      key: "recruitment-data-room",
      route: INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
      targetId: "infrastructure-data-room",
      title: "La Data Room fiabilise le recrutement",
      content:
        "Ses trois niveaux réduisent progressivement l’incertitude des rapports du Bureau des transferts. Le niveau 1 révèle trois notes exactes, le niveau 2 en révèle cinq et supprime les inconnues, puis le niveau 3 affiche sept notes exactes avec des fourchettes très resserrées.\n\nElle améliore l’information disponible, mais ne transforme jamais les qualités réelles d’un coureur.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "staff-academy",
      route: INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
      targetId: "infrastructure-staff-academy",
      title: "L’Académie des métiers développe le staff",
      content:
        "Cette infrastructure de haut niveau permet d’envoyer un membre du staff ou un entraîneur en stage pour lui ajouter une étoile ou une nouvelle ligne de talent disponible. Le nouveau bonus est attribué à la fin du stage ; jusque-là, la personne continue d’exercer normalement avec ses effets actuels.\n\nChaque niveau de l’Académie ajoute un stage simultané, jusqu’à cinq. Le prix et la durée augmentent avec le niveau du membre et la complexité de l’amélioration.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "international-school-effect",
      route: INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE,
      targetId: "infrastructure-school-effect",
      title: "Les écoles améliorent les jeunes du pays",
      content: `Chaque étoile de centre construite dans un pays ajoute 10 points de probabilité qu’un jeune détecté dans ce pays gagne une étoile entière de potentiel. Les contributions de toutes les équipes se cumulent, jusqu’au plafond mondial de ${MAX_INTERNATIONAL_CENTER_BONUS_PERCENTAGE} %.\n\nL’effet intervient lors de la génération du jeune dans un rapport de scouting : il ne modifie pas rétroactivement les coureurs déjà découverts.`,
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "international-school-map",
      route: INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE,
      targetId: "infrastructure-school-map",
      title: "Choisissez le pays avant d’investir",
      content:
        "La carte affiche les centres déjà financés par la communauté. Sélectionnez un pays pour consulter ses étoiles mondiales, la chance partagée et les équipes qui y possèdent déjà une école.\n\nVotre propre centre peut atteindre cinq niveaux. Chaque amélioration coûte davantage et dure plus longtemps ; elle reste soumise au chantier unique et peut bénéficier d’un architecte.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "international-school-strategy",
      route: INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE,
      targetId: "infrastructure-school-map",
      title: "Concentrez ou diversifiez votre réseau",
      content:
        "Renforcer un pays déjà développé augmente rapidement une probabilité partagée, tandis qu’ouvrir une école dans une nation peu couverte crée une nouvelle zone de détection améliorée.\n\nLe bonus appartient au pays, pas à l’équipe qui a payé : tous les DS profitent du total mondial lorsqu’ils y découvrent un jeune.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE,
      title: "Votre stratégie d’infrastructures est prête",
      content:
        "Vous savez maintenant planifier un chantier, utiliser un architecte, distinguer les effets de la Data Room et de l’Académie des métiers, puis comprendre la construction et le bonus partagé des écoles internationales.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera accessible depuis le point d’interrogation de la rubrique Infrastructures.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
