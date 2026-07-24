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

/**
 * Catalogue actuellement vide.
 *
 * Les parcours fonctionnels seront ajoutés uniquement après validation
 * commune de leurs étapes, de leur ordre, de leurs cibles et de leurs
 * textes associés.
 */
export const tutorialCatalog = createTutorialCatalog([]);

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