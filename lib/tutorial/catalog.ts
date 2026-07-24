import { GAMEPLAY_RULES } from "@/lib/gameplay-rules";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";
import {
  TUTORIAL_RACE_KEY,
  TUTORIAL_RACE_ROUTE,
  TUTORIAL_RACE_VERSION,
} from "@/lib/tutorial/tutorial-race";
import type {
  TutorialCatalog,
  TutorialDefinition,
} from "@/types/tutorial";

const TUTORIAL_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

function validateTutorialDefinition(
  definition: TutorialDefinition,
): void {
  if (!TUTORIAL_KEY_PATTERN.test(definition.key)) {
    throw new Error(
      `La clé de didacticiel "${definition.key}" est invalide.`,
    );
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
  steps: [
    {
      key: "welcome",
      route: "/jeu",
      title: "Bienvenue dans Cyclostratège",
      content:
        "Vous êtes désormais Directeur Sportif d’une jeune structure cycliste. Ce parcours présente les fonctions essentielles du jeu et vous prépare à votre future course d’initiation.\n\nVous pouvez quitter à tout moment, reprendre plus tard ou passer définitivement le didacticiel.",
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
        "Le calendrier rassemble les courses d’un jour et les tours à étapes. Leur catégorie, leur profil et leur calendrier déterminent leur difficulté, leur prestige et les points disponibles.\n\nVous devrez inscrire votre équipe puis choisir les coureurs adaptés au parcours. Une course d’initiation sans conséquence officielle sera ajoutée dans la prochaine étape du projet.",
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
        "Vous avez terminé le tutoriel de base de Cyclostratège.\n\nRendez-vous maintenant dans le menu Didacticiels pour compléter votre formation et obtenir le succès « Finaliser le didacticiel ».\n\nLa course d’initiation et les futures visites guidées des rubriques rejoindront progressivement cette bibliothèque.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;


const tutorialRace = {
  key: TUTORIAL_RACE_KEY,
  version: TUTORIAL_RACE_VERSION,
  type: "race_scenario",
  title: "Course d’initiation",
  description:
    "Sélectionnez cinq coureurs et découvrez le véritable moteur de course sans conséquence officielle.",
  autoStart: false,
  replayable: true,
  displayMode: "embedded",
  steps: [
    {
      key: "experience",
      route: TUTORIAL_RACE_ROUTE,
      title: "Critérium de découverte",
      content:
        "Composez votre sélection, suivez le direct accéléré puis validez le classement de démonstration.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;

export const tutorialCatalog = createTutorialCatalog([
  onboardingTutorial,
  tutorialRace,
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
  return listTutorialDefinitions().filter(
    (definition) => definition.autoStart,
  );
}