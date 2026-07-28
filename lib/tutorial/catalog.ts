import { GAMEPLAY_RULES } from "@/lib/gameplay-rules";
import {
  CRITERIUM_DISCOVERY_COMPLETION_STEP_KEY,
  CRITERIUM_DISCOVERY_KEY,
  CRITERIUM_DISCOVERY_RACE_ROUTE,
  CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEY,
  CRITERIUM_DISCOVERY_RESULTS_ROUTE,
  CRITERIUM_DISCOVERY_VERSION,
} from "@/lib/tutorial/criterium-discovery";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";
import { medicalCenterTutorialDefinition } from "@/lib/tutorial/medical-center";
import { rosterTutorialDefinition } from "@/lib/tutorial/roster";
import { trainingTutorialDefinition } from "@/lib/tutorial/training";
import { staffTutorialDefinition } from "@/lib/tutorial/staff";
import { transferTutorialDefinition } from "@/lib/tutorial/transfers";
import { equipmentTutorialDefinition } from "@/lib/tutorial/equipment";
import { infrastructureTutorialDefinition } from "@/lib/tutorial/infrastructure";
import { youthDevelopmentTutorialDefinition } from "@/lib/tutorial/youth-development";
import type { TutorialCatalog, TutorialDefinition } from "@/types/tutorial";

const TUTORIAL_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

function validateTutorialDefinition(definition: TutorialDefinition): void {
  if (!TUTORIAL_KEY_PATTERN.test(definition.key)) {
    throw new Error(`La clé de didacticiel "${definition.key}" est invalide.`);
  }

  if (definition.version < 1) {
    throw new Error(
      `La version du didacticiel "${definition.key}" doit être positive.`,
    );
  }

  if (definition.steps.length === 0) {
    throw new Error(
      `Le didacticiel "${definition.key}" ne contient aucune étape.`,
    );
  }

  const stepKeys = new Set<string>();

  for (const step of definition.steps) {
    if (!TUTORIAL_KEY_PATTERN.test(step.key)) {
      throw new Error(
        `La clé d’étape "${step.key}" du didacticiel "${definition.key}" est invalide.`,
      );
    }

    if (stepKeys.has(step.key)) {
      throw new Error(
        `La clé d’étape "${step.key}" est déclarée plusieurs fois dans le didacticiel "${definition.key}".`,
      );
    }

    if (!step.route.startsWith("/")) {
      throw new Error(
        `La route "${step.route}" du didacticiel "${definition.key}" doit commencer par "/".`,
      );
    }

    if (step.targetId && !TUTORIAL_KEY_PATTERN.test(step.targetId)) {
      throw new Error(
        `La cible "${step.targetId}" du didacticiel "${definition.key}" est invalide.`,
      );
    }

    if (step.routeTargetId && !TUTORIAL_KEY_PATTERN.test(step.routeTargetId)) {
      throw new Error(
        `La cible de navigation "${step.routeTargetId}" du didacticiel "${definition.key}" est invalide.`,
      );
    }

    stepKeys.add(step.key);
  }
}

export function createTutorialCatalog(
  definitions: readonly TutorialDefinition[],
): TutorialCatalog {
  const catalog: Record<string, TutorialDefinition> = {};

  for (const definition of definitions) {
    validateTutorialDefinition(definition);

    if (catalog[definition.key]) {
      throw new Error(
        `Le didacticiel "${definition.key}" est déclaré plusieurs fois.`,
      );
    }

    catalog[definition.key] = Object.freeze({
      ...definition,
      steps: Object.freeze([...definition.steps]),
    });
  }

  return Object.freeze(catalog);
}

const onboardingTutorial = {
  key: ONBOARDING_TUTORIAL_KEY,
  version: 1,
  type: "onboarding",
  title: "Premiers pas dans Cyclostratège",
  description:
    "Découvrez les bases du métier de Directeur Sportif, de la fondation de votre équipe au sponsoring.",
  autoStart: true,
  replayable: true,
  followUpTutorialKey: CRITERIUM_DISCOVERY_KEY,
  steps: [
    {
      key: "welcome",
      route: "/jeu",
      title: "Bienvenue dans Cyclostratège",
      content:
        "Vous êtes désormais Directeur Sportif d’une jeune structure cycliste. Ce parcours présente les fonctions essentielles du jeu et vous prépare au Critérium de la découverte.\n\nVous pouvez quitter à tout moment, reprendre plus tard ou passer définitivement le didacticiel.",
      placement: "center",
    },
    {
      key: "news-feed",
      route: "/jeu",
      targetId: "dashboard-news-feed",
      title: "Suivez la vie de votre équipe",
      content:
        "Le fil d’actualité rassemble les événements importants de votre carrière : résultats de courses, blessures, retours de scouting, entraînements, finances, contrats et décisions à traiter.\n\nConsultez-le régulièrement pour adapter vos choix sportifs et financiers.",
      placement: "bottom",
    },
    {
      key: "profile-overview",
      route: "/jeu",
      targetId: "dashboard-director-profile",
      title: "Finalisez votre identité",
      content:
        "Avant de découvrir votre effectif, vous devez finaliser le profil de votre Directeur Sportif. Votre nom affiché et votre avatar resteront modifiables, mais votre nationalité sera définitive après validation.\n\nCliquez sur Suivant pour ouvrir votre profil.",
      placement: "right",
    },
    {
      key: "profile-form",
      route: "/jeu/directeur-sportif",
      targetId: "profile-form",
      title: "Créez votre Directeur Sportif",
      content:
        "Choisissez votre nom affiché, votre avatar et votre nationalité. L’avatar pourra évoluer plus tard ; la nationalité est un choix irréversible qui représente durablement votre Directeur Sportif.\n\nComplétez le formulaire puis validez votre profil. Le parcours ne pourra pas avancer tant que cette étape n’est pas enregistrée.",
      placement: "right",
      allowTargetInteraction: true,
      highlightPadding: 10,
    },
    {
      key: "team-foundation",
      route: "/jeu/directeur-sportif",
      targetId: "team-foundation-area",
      title: "Fondez votre structure amateur",
      content:
        "Le nom choisi devient l’identité fondatrice de votre équipe. Son pays d’affiliation est définitif : il détermine vos sept premiers coureurs et influence la priorité géographique des futurs sponsors.\n\nLe maillot amateur, lui, pourra être modifié plus tard. Fondez l’équipe avant de poursuivre.",
      placement: "left",
      requirement: "profile_complete",
      allowTargetInteraction: true,
      highlightPadding: 10,
    },
    {
      key: "roster-overview",
      route: "/jeu/effectif",
      targetId: "roster-overview",
      title: "Découvrez votre premier effectif",
      content:
        "Votre structure amateur débute avec sept coureurs. Cette page réunit leur âge, leur profil, leur potentiel, leur contrat et toutes leurs caractéristiques sportives.",
      placement: "bottom",
      requirement: "team_created",
    },
    {
      key: "primary-ratings",
      route: "/jeu/effectif",
      targetId: "roster-rating-table",
      title: "Commencez par les notes primaires",
      content:
        "Concentrez-vous d’abord sur MON, VAL, PLA, PAV, SPR, CLM et PRO. Elles indiquent immédiatement les terrains favoris du coureur.\n\nÉtape plate → PLA et SPR\nMontagne → MON\nParcours vallonné → VAL\nPavés → PAV\nContre-la-montre ou prologue → CLM et PRO",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "secondary-ratings",
      route: "/jeu/effectif",
      targetId: "roster-rating-table",
      title: "Affinez ensuite votre analyse",
      content:
        "ACC, DES, END, RES, REC et BAR sont des caractéristiques secondaires. Elles départagent les coureurs proches en influençant l’accélération, la descente, l’endurance, la résistance, la récupération et les échappées.\n\nAu début, ne cherchez pas à tout mémoriser : identifiez d’abord le profil de l’étape, puis les notes primaires correspondantes.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "calendar",
      route: "/jeu/calendrier",
      targetId: "calendar-races",
      title: "Planifiez une saison de 28 jours",
      content:
        "Le calendrier rassemble les courses d’un jour et les tours à étapes. Leur catégorie, leur profil et leur calendrier déterminent leur difficulté, leur prestige et les points disponibles.\n\nVous devrez inscrire votre équipe puis choisir les coureurs adaptés au parcours. Le Critérium de la découverte est disponible depuis le menu Didacticiels et suit exactement ce parcours d’inscription.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "reputation",
      route: "/jeu",
      targetId: "dashboard-reputation",
      title: "Construisez votre réputation",
      content: `Votre réputation progresse grâce aux résultats, aux objectifs et à la bonne gestion de votre structure. À partir de ${GAMEPLAY_RULES.sponsoringUnlockReputation} points, des sponsors peuvent vous proposer de transformer votre équipe amateur en structure professionnelle.`,
      placement: "right",
    },
    {
      key: "sponsoring-overview",
      route: "/jeu/sponsoring",
      targetId: "sponsoring-overview",
      title: "Préparez votre passage chez les professionnels",
      content: `Tant que votre réputation reste inférieure à ${GAMEPLAY_RULES.sponsoringUnlockReputation}, le marché demeure verrouillé. Une fois le seuil atteint, vous recevrez des propositions comportant un budget, une durée de contrat et des objectifs sportifs ou structurels.`,
      placement: "bottom",
    },
    {
      key: "sponsoring-demo-offer",
      route: "/jeu/sponsoring",
      targetId: "sponsoring-demo-offer",
      title: "Apprenez à lire une offre",
      content:
        "Cette proposition est un aperçu fictif : elle ne peut pas être signée et ne modifie aucune donnée. Comparez toujours le budget, la durée et l’ensemble des objectifs. Une offre généreuse peut imposer des engagements plus exigeants.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: "/jeu",
      title: "Les bases sont acquises",
      content:
        "Vous avez terminé le tutoriel de base de Cyclostratège.\n\nVous pouvez maintenant enchaîner directement avec le Critérium de la découverte : vous composerez une équipe, attribuerez les rôles tactiques puis suivrez votre première course en live, sans aucune conséquence sur votre saison.\n\nVous pourrez aussi retrouver cette formation plus tard depuis le menu Didacticiels.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;

const criteriumDiscoveryTutorial = {
  key: CRITERIUM_DISCOVERY_KEY,
  version: CRITERIUM_DISCOVERY_VERSION,
  type: "race_scenario",
  title: "Critérium de la découverte",
  description:
    "Composez votre première sélection, découvrez les décisions de l’IA et suivez une course fictive dans le véritable espace Live.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "briefing",
      route: CRITERIUM_DISCOVERY_RACE_ROUTE,
      targetId: "criterium-briefing",
      title: "Votre première course, sans risque",
      content:
        "Bienvenue au Critérium de la découverte. Cette épreuve fictive utilise le même moteur et les mêmes écrans qu’une course officielle.\n\nElle ne rapporte ni argent, ni points, ni récompense. Elle ne retire aucune forme, ne crée aucune fatigue et ne peut provoquer aucune blessure persistante. Les adversaires sont volontairement très faibles pour vous donner toutes les chances de décrocher une première victoire.",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 10,
    },
    {
      key: "course-profile",
      route: CRITERIUM_DISCOVERY_RACE_ROUTE,
      targetId: "criterium-course-profile",
      title: "Lisez d’abord le profil",
      content:
        "Le parcours mélange plaine, vallons, montagne et pavés. Le profil indique quelles notes comparer avant de choisir vos cinq coureurs.\n\nSur une vraie course, cette lecture doit toujours précéder l’inscription : elle détermine le leader naturel, l’intérêt d’un sprinteur et le nombre d’équipiers nécessaires.",
      placement: "right",
      highlightPadding: 8,
    },
    {
      key: "rider-selection",
      route: CRITERIUM_DISCOVERY_RACE_ROUTE,
      targetId: "criterium-rider-selection",
      title: "Sélectionnez exactement cinq coureurs",
      content:
        "Cochez cinq coureurs disponibles. Pour ce parcours mixte, cherchez un profil complet : un bon coureur de vallons ou de montagne pour jouer la victoire, un sprinteur si vous anticipez un regroupement, puis des coureurs solides en plaine, endurance et résistance.\n\nVous pouvez ouvrir chaque fiche dans un nouvel onglet sans quitter cette sélection.",
      placement: "left",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: "role-guide",
      route: CRITERIUM_DISCOVERY_RACE_ROUTE,
      targetId: "criterium-role-guide",
      title: "Ce que les rôles demandent réellement à l’IA",
      content:
        "Leader : l’IA préserve ce coureur pour les secteurs décisifs et valorise ses qualités sur le terrain final.\n\nSprinteur : son équipe augmente la poursuite et prépare une arrivée groupée. Poisson pilote : il travaille et renforce le train de sprint. Électron libre : il reçoit une forte priorité pour prendre l’échappée. Équipier : il dépense davantage d’énergie dans la poursuite et le travail collectif.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "role-assignment",
      route: CRITERIUM_DISCOVERY_RACE_ROUTE,
      targetId: "criterium-role-assignment",
      title: "Attribuez votre stratégie",
      content:
        "Choisissez les rôles dans les listes affichées sous les coureurs sélectionnés. Un seul leader et un seul sprinteur sont autorisés.\n\nSi vous laissez « Automatique », l’IA analyse le profil et les statistiques : elle choisit d’abord un sprinteur lorsque l’arrivée semble favorable, puis le meilleur leader, un poisson pilote, un électron libre, et transforme les autres coureurs en équipiers.",
      placement: "left",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: "registration",
      route: CRITERIUM_DISCOVERY_RACE_ROUTE,
      targetId: "criterium-registration-submit",
      title: "Verrouillez votre composition",
      content:
        "Lorsque vos cinq coureurs et leurs rôles sont prêts, validez l’inscription avec le bouton mis en évidence.\n\nComme sur une course officielle, la composition est alors verrouillée. Pour cette formation seulement, la simulation est calculée immédiatement et stockée dans la progression du didacticiel, sans toucher aux données sportives de vos coureurs.",
      placement: "left",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEY,
      route: "/jeu/calendrier",
      targetId: "criterium-registration-confirmation",
      title: "Inscription confirmée",
      content:
        "Votre équipe est inscrite et la course apparaît dans le calendrier comme une épreuve normale. La différence reste invisible pour le moteur d’affichage, mais essentielle pour votre carrière : aucun règlement officiel ne sera exécuté.\n\nCliquez sur Suivant pour rejoindre directement le replay dans Résultats / Live.",
      placement: "bottom",
      requirement: "criterium_registered",
      highlightPadding: 8,
    },
    {
      key: "live-overview",
      route: CRITERIUM_DISCOVERY_RESULTS_ROUTE,
      targetId: "criterium-live-replay",
      title: "Bienvenue dans le Live",
      content:
        "Vous retrouvez ici le véritable affichage des courses : profil actif, groupes, écarts, commentaires et animation de l’arrivée.\n\nLa simulation est déjà verrouillée. La relire ou changer la vitesse ne relance pas le calcul et ne peut donc modifier le résultat.",
      placement: "top",
      requirement: "criterium_registered",
      highlightPadding: 8,
    },
    {
      key: "replay-controls",
      route: CRITERIUM_DISCOVERY_RESULTS_ROUTE,
      targetId: "race-replay-controls",
      title: "Pilotez le replay",
      content:
        "Lancez la lecture, mettez-la en pause ou accélérez en ×2 et ×4. Vous pouvez aussi sélectionner un tronçon du profil pour observer directement un moment de course.\n\nRegardez comment les groupes évoluent : les rôles attribués orientent les échappées, la poursuite du peloton et la préparation du sprint.",
      placement: "bottom",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: "classification",
      route: CRITERIUM_DISCOVERY_RESULTS_ROUTE,
      targetId: "race-live-tabs",
      title: "Analysez le classement",
      content:
        "Ouvrez l’onglet « Classement » pour consulter l’ordre d’arrivée et les écarts, puis l’onglet « Règles actives » pour revoir les principes du moteur.\n\nLes adversaires de cette initiation sont bridés et privés de bonus afin qu’un coureur de votre équipe puisse viser la première place.",
      placement: "bottom",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: CRITERIUM_DISCOVERY_COMPLETION_STEP_KEY,
      route: CRITERIUM_DISCOVERY_RESULTS_ROUTE,
      targetId: "criterium-tutorial-completion",
      title: "Votre première course est terminée",
      content:
        "Vous savez maintenant lire un profil, composer une sélection, donner des rôles tactiques et suivre le moteur en direct.\n\nCette course reste entièrement fictive : aucune forme, fatigue, blessure, prime, point ou récompense n’a été enregistré. Cliquez sur Terminer dans cette infobulle pour valider la formation pratique.",
      placement: "top",
      requirement: "criterium_registered",
      highlightPadding: 8,
    },
  ],
} satisfies TutorialDefinition;

export const tutorialCatalog = createTutorialCatalog([
  onboardingTutorial,
  criteriumDiscoveryTutorial,
  medicalCenterTutorialDefinition,
  rosterTutorialDefinition,
  trainingTutorialDefinition,
  staffTutorialDefinition,
  transferTutorialDefinition,
  equipmentTutorialDefinition,
  infrastructureTutorialDefinition,
  youthDevelopmentTutorialDefinition,
]);

export function getTutorialDefinition(
  tutorialKey: string,
): TutorialDefinition | null {
  return tutorialCatalog[tutorialKey] ?? null;
}

export function listTutorialDefinitions(): readonly TutorialDefinition[] {
  return Object.values(tutorialCatalog);
}

export function listAutoStartTutorialDefinitions(): readonly TutorialDefinition[] {
  return listTutorialDefinitions().filter((definition) => definition.autoStart);
}
