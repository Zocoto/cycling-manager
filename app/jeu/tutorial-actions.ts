"use server";

import { z } from "zod";

import {
  getActiveTutorialSession,
  getAuthenticatedTutorialProgress,
  requireAuthenticatedSportingDirectorId,
} from "@/lib/tutorial/progress";
import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import { getTutorialRequirementError } from "@/lib/tutorial/onboarding";
import {
  CRITERIUM_DISCOVERY_KEY,
  getCriteriumDiscoveryRunFromMetadata,
} from "@/lib/tutorial/criterium-discovery";
import { EQUIPMENT_TUTORIAL_KEY } from "@/lib/tutorial/equipment";
import { getAuthenticatedTutorialOnboardingState } from "@/lib/tutorial/onboarding-state";
import {
  matchesTutorialRoute,
  resolveTutorialProgressRoute,
} from "@/lib/tutorial/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TutorialDefinition,
  TutorialProgressRow,
  TutorialSessionLaunchSource,
  TutorialSessionRow,
  TutorialStep,
} from "@/types/tutorial";

const TUTORIAL_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

const tutorialKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(TUTORIAL_KEY_PATTERN);

const stepKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(TUTORIAL_KEY_PATTERN);

const routeSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => value.startsWith("/"),
    "La route doit commencer par « / ».",
  );

const launchSourceSchema = z.enum(["automatic", "manual", "resume", "replay"]);

const startTutorialSchema = z.object({
  tutorialKey: tutorialKeySchema,
  launchSource: launchSourceSchema,
  restartFromBeginning: z.boolean().optional().default(false),
});

const tutorialStepSchema = z.object({
  tutorialKey: tutorialKeySchema,
  stepKey: stepKeySchema,
  route: routeSchema,
});

const tutorialKeyOnlySchema = z.object({
  tutorialKey: tutorialKeySchema,
});

type TutorialActionSuccess = {
  ok: true;
  progress: TutorialProgressRow;
  session: TutorialSessionRow | null;
  currentStepKey: string | null;
};

type TutorialActionFailure = {
  ok: false;
  error: string;
};

type TutorialActionResult = TutorialActionSuccess | TutorialActionFailure;

function actionFailure(error: unknown): TutorialActionFailure {
  if (error instanceof Error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: false,
    error: "Une erreur inattendue est survenue pendant le didacticiel.",
  };
}

function requireTutorialDefinition(tutorialKey: string): TutorialDefinition {
  const definition = getTutorialDefinition(tutorialKey);

  if (!definition) {
    throw new Error(
      `Le didacticiel « ${tutorialKey} » n’existe pas dans le catalogue.`,
    );
  }

  return definition;
}

function requireTutorialStep(
  definition: TutorialDefinition,
  stepKey: string,
  route: string,
) {
  const step = definition.steps.find((candidate) => candidate.key === stepKey);

  if (!step) {
    throw new Error(
      `L’étape « ${stepKey} » n’existe pas dans le didacticiel « ${definition.key} ».`,
    );
  }

  if (!matchesTutorialRoute(step.route, route)) {
    throw new Error(
      `La route « ${route} » ne correspond pas à l’étape « ${stepKey} ».`,
    );
  }

  return step;
}

async function requireTutorialStepRequirement({
  supabase,
  step,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  step: TutorialStep;
}): Promise<void> {
  if (!step.requirement) {
    return;
  }

  if (step.requirement === "criterium_registered") {
    const progress = await getAuthenticatedTutorialProgress(
      supabase,
      CRITERIUM_DISCOVERY_KEY,
    );

    if (!getCriteriumDiscoveryRunFromMetadata(progress?.metadata)) {
      throw new Error(
        "Validez d’abord l’inscription de vos cinq coureurs avant de poursuivre vers le Live.",
      );
    }

    return;
  }

  const state = await getAuthenticatedTutorialOnboardingState(supabase);

  const requirementError = getTutorialRequirementError({
    requirement: step.requirement,
    state,
  });

  if (requirementError) {
    throw new Error(requirementError);
  }
}

function getInitialStep(definition: TutorialDefinition) {
  const step = definition.steps[0];

  if (!step) {
    throw new Error(
      `Le didacticiel « ${definition.key} » ne contient aucune étape.`,
    );
  }

  return step;
}

function getResumeStep(
  definition: TutorialDefinition,
  progress: TutorialProgressRow,
) {
  if (progress.current_step_key) {
    const savedStep = definition.steps.find(
      (step) => step.key === progress.current_step_key,
    );

    if (savedStep) {
      return savedStep;
    }
  }

  return getInitialStep(definition);
}

async function getFirstIncompleteStep({
  supabase,
  definition,
  startingStep,
  progress,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  definition: TutorialDefinition;
  startingStep: TutorialStep;
  progress: TutorialProgressRow;
}): Promise<TutorialStep> {
  const startingIndex = Math.max(
    0,
    definition.steps.findIndex((step) => step.key === startingStep.key),
  );
  let onboardingStatePromise: ReturnType<
    typeof getAuthenticatedTutorialOnboardingState
  > | null = null;

  for (let index = startingIndex; index < definition.steps.length; index += 1) {
    const candidate = definition.steps[index];

    if (!candidate) {
      continue;
    }

    const completionRequirement = candidate.skipWhenRequirementSatisfied;

    if (!completionRequirement) {
      return candidate;
    }

    if (completionRequirement === "criterium_registered") {
      if (!getCriteriumDiscoveryRunFromMetadata(progress.metadata)) {
        return candidate;
      }

      continue;
    }

    onboardingStatePromise ??=
      getAuthenticatedTutorialOnboardingState(supabase);
    const onboardingState = await onboardingStatePromise;
    const isSatisfied =
      completionRequirement === "profile_complete"
        ? onboardingState.profileComplete
        : onboardingState.teamCreated;

    if (!isSatisfied) {
      return candidate;
    }
  }

  return definition.steps.at(-1) ?? startingStep;
}

async function updateProgressStep({
  supabase,
  progress,
  definition,
  stepKey,
  route,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  progress: TutorialProgressRow;
  definition: TutorialDefinition;
  stepKey: string;
  route: string;
}): Promise<TutorialProgressRow> {
  if (progress.status !== "in_progress") {
    return progress;
  }

  const { data, error } = await supabase
    .from("tutorial_progress")
    .update({
      tutorial_version: definition.version,
      current_step_key: stepKey,
      current_route: route,
    })
    .eq("id", progress.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Impossible d’enregistrer l’étape du didacticiel : ${error.message}`,
    );
  }

  return data as TutorialProgressRow;
}

async function updateActiveSessionStep({
  supabase,
  session,
  definition,
  stepKey,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  session: TutorialSessionRow;
  definition: TutorialDefinition;
  stepKey: string;
}): Promise<TutorialSessionRow> {
  const { data, error } = await supabase
    .from("tutorial_sessions")
    .update({
      tutorial_version: definition.version,
      last_step_key: stepKey,
    })
    .eq("id", session.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Impossible d’enregistrer la session du didacticiel : ${error.message}`,
    );
  }

  return data as TutorialSessionRow;
}

async function finishSession({
  supabase,
  session,
  status,
  lastStepKey,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  session: TutorialSessionRow;
  status: "completed" | "abandoned" | "skipped";
  lastStepKey: string | null;
}): Promise<TutorialSessionRow> {
  const { data, error } = await supabase
    .from("tutorial_sessions")
    .update({
      status,
      last_step_key: lastStepKey,
      ended_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Impossible de terminer la session du didacticiel : ${error.message}`,
    );
  }

  return data as TutorialSessionRow;
}

async function createTutorialSession({
  supabase,
  progress,
  definition,
  launchSource,
  firstStepKey,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  progress: TutorialProgressRow;
  definition: TutorialDefinition;
  launchSource: TutorialSessionLaunchSource;
  firstStepKey: string;
}): Promise<TutorialSessionRow> {
  const { data, error } = await supabase
    .from("tutorial_sessions")
    .insert({
      tutorial_progress_id: progress.id,
      tutorial_version: definition.version,
      launch_source: launchSource,
      status: "in_progress",
      first_step_key: firstStepKey,
      last_step_key: firstStepKey,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Impossible de démarrer la session du didacticiel : ${error.message}`,
    );
  }

  return data as TutorialSessionRow;
}

export async function startTutorialAction(
  input: unknown,
): Promise<TutorialActionResult> {
  try {
    const parsed = startTutorialSchema.parse(input);

    const definition = requireTutorialDefinition(parsed.tutorialKey);

    if (parsed.launchSource === "automatic" && !definition.autoStart) {
      throw new Error("Ce didacticiel ne peut pas démarrer automatiquement.");
    }

    if (parsed.launchSource === "replay" && !definition.replayable) {
      throw new Error("Ce didacticiel ne peut pas être rejoué.");
    }

    const supabase = await createSupabaseServerClient();

    const sportingDirectorId =
      await requireAuthenticatedSportingDirectorId(supabase);

    let progress = await getAuthenticatedTutorialProgress(
      supabase,
      definition.key,
    );

    const now = new Date().toISOString();
    const initialStep = getInitialStep(definition);

    if (!progress) {
      const { data, error } = await supabase
        .from("tutorial_progress")
        .insert({
          sporting_director_id: sportingDirectorId,
          tutorial_key: definition.key,
          tutorial_type: definition.type,
          tutorial_version: definition.version,
          status: "in_progress",
          current_step_key: initialStep.key,
          current_route: initialStep.route,
          started_at: now,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Impossible de créer la progression du didacticiel : ${error.message}`,
        );
      }

      progress = data as TutorialProgressRow;
    }

    if (
      parsed.launchSource === "automatic" &&
      progress.status !== "not_started" &&
      progress.status !== "in_progress"
    ) {
      throw new Error("Ce didacticiel a déjà été terminé ou ignoré.");
    }

    const isHistoricalReplay =
      progress.status === "completed" || progress.status === "skipped";

    const requestedStep =
      parsed.restartFromBeginning || isHistoricalReplay
        ? initialStep
        : getResumeStep(definition, progress);
    const selectedStep = await getFirstIncompleteStep({
      supabase,
      definition,
      startingStep: requestedStep,
      progress,
    });
    const selectedRoute = resolveTutorialProgressRoute({
      routePattern: selectedStep.route,
      savedRoute: progress.current_route,
      preserveSavedRoute:
        !parsed.restartFromBeginning &&
        progress.current_step_key === selectedStep.key,
    });

    await requireTutorialStepRequirement({
      supabase,
      step: selectedStep,
    });

    if (progress.status === "not_started") {
      const { data, error } = await supabase
        .from("tutorial_progress")
        .update({
          tutorial_type: definition.type,
          tutorial_version: definition.version,
          status: "in_progress",
          current_step_key: selectedStep.key,
          current_route: selectedRoute,
          started_at: now,
          completed_at: null,
          skipped_at: null,
        })
        .eq("id", progress.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Impossible de démarrer le didacticiel : ${error.message}`,
        );
      }

      progress = data as TutorialProgressRow;
    } else if (progress.status === "in_progress") {
      progress = await updateProgressStep({
        supabase,
        progress,
        definition,
        stepKey: selectedStep.key,
        route: selectedRoute,
      });
    }

    if (definition.key === EQUIPMENT_TUTORIAL_KEY) {
      const { error: giftError } = await supabase.rpc(
        "grant_equipment_tutorial_welcome_gift",
      );

      if (giftError) {
        throw new Error(
          "Impossible de remettre les Lunettes didactiques : " +
            giftError.message,
        );
      }

      progress =
        (await getAuthenticatedTutorialProgress(supabase, definition.key)) ??
        progress;
    }

    let session = await getActiveTutorialSession(supabase, progress.id);

    if (session) {
      session = await updateActiveSessionStep({
        supabase,
        session,
        definition,
        stepKey: selectedStep.key,
      });
    } else {
      const launchSource = isHistoricalReplay ? "replay" : parsed.launchSource;

      session = await createTutorialSession({
        supabase,
        progress,
        definition,
        launchSource,
        firstStepKey: selectedStep.key,
      });
    }

    return {
      ok: true,
      progress,
      session,
      currentStepKey: selectedStep.key,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setTutorialStepAction(
  input: unknown,
): Promise<TutorialActionResult> {
  try {
    const parsed = tutorialStepSchema.parse(input);

    const definition = requireTutorialDefinition(parsed.tutorialKey);

    const requestedStep = requireTutorialStep(
      definition,
      parsed.stepKey,
      parsed.route,
    );

    const supabase = await createSupabaseServerClient();

    const now = new Date().toISOString();

    let progress = await getAuthenticatedTutorialProgress(
      supabase,
      definition.key,
    );

    if (!progress) {
      const sportingDirectorId =
        await requireAuthenticatedSportingDirectorId(supabase);

      const { data, error } = await supabase
        .from("tutorial_progress")
        .insert({
          sporting_director_id: sportingDirectorId,
          tutorial_key: definition.key,
          tutorial_type: definition.type,
          tutorial_version: definition.version,
          status: "in_progress",
          current_step_key: parsed.stepKey,
          current_route: parsed.route,
          started_at: now,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Impossible de créer la progression du didacticiel : ${error.message}`,
        );
      }

      progress = data as TutorialProgressRow;
    }

    const step = await getFirstIncompleteStep({
      supabase,
      definition,
      startingStep: requestedStep,
      progress,
    });
    const stepRoute =
      step.key === requestedStep.key ? parsed.route : step.route;

    await requireTutorialStepRequirement({
      supabase,
      step,
    });

    if (progress.status === "not_started") {
      const { data, error } = await supabase
        .from("tutorial_progress")
        .update({
          tutorial_type: definition.type,
          tutorial_version: definition.version,
          status: "in_progress",
          current_step_key: step.key,
          current_route: stepRoute,
          started_at: now,
          completed_at: null,
          skipped_at: null,
        })
        .eq("id", progress.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Impossible de relancer le didacticiel : ${error.message}`,
        );
      }

      progress = data as TutorialProgressRow;
    }

    let session = await getActiveTutorialSession(supabase, progress.id);

    if (!session && progress.status === "in_progress") {
      session = await createTutorialSession({
        supabase,
        progress,
        definition,
        launchSource: "manual",
        firstStepKey: step.key,
      });
    }

    if (!session && progress.status === "in_progress") {
      throw new Error("Aucune session active n’existe pour ce didacticiel.");
    }

    progress = await updateProgressStep({
      supabase,
      progress,
      definition,
      stepKey: step.key,
      route: stepRoute,
    });

    const updatedSession = session
      ? await updateActiveSessionStep({
          supabase,
          session,
          definition,
          stepKey: step.key,
        })
      : null;

    return {
      ok: true,
      progress,
      session: updatedSession,
      currentStepKey: step.key,
    };
  } catch (error) {
    return actionFailure(error);
  }
}
export async function quitTutorialAction(
  input: unknown,
): Promise<TutorialActionResult> {
  try {
    const parsed = tutorialStepSchema.parse(input);

    const definition = requireTutorialDefinition(parsed.tutorialKey);

    requireTutorialStep(definition, parsed.stepKey, parsed.route);

    const supabase = await createSupabaseServerClient();

    let progress = await getAuthenticatedTutorialProgress(
      supabase,
      definition.key,
    );

    if (!progress) {
      throw new Error("Aucune progression n’existe pour ce didacticiel.");
    }

    progress = await updateProgressStep({
      supabase,
      progress,
      definition,
      stepKey: parsed.stepKey,
      route: parsed.route,
    });

    const activeSession = await getActiveTutorialSession(supabase, progress.id);

    const session = activeSession
      ? await finishSession({
          supabase,
          session: activeSession,
          status: "abandoned",
          lastStepKey: parsed.stepKey,
        })
      : null;

    return {
      ok: true,
      progress,
      session,
      currentStepKey: parsed.stepKey,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function skipTutorialAction(
  input: unknown,
): Promise<TutorialActionResult> {
  try {
    const parsed = tutorialKeyOnlySchema.parse(input);

    const definition = requireTutorialDefinition(parsed.tutorialKey);

    const supabase = await createSupabaseServerClient();

    const sportingDirectorId =
      await requireAuthenticatedSportingDirectorId(supabase);

    let progress = await getAuthenticatedTutorialProgress(
      supabase,
      definition.key,
    );

    const now = new Date().toISOString();

    if (!progress) {
      const { data, error } = await supabase
        .from("tutorial_progress")
        .insert({
          sporting_director_id: sportingDirectorId,
          tutorial_key: definition.key,
          tutorial_type: definition.type,
          tutorial_version: definition.version,
          status: "skipped",
          skipped_at: now,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Impossible d’ignorer le didacticiel : ${error.message}`,
        );
      }

      progress = data as TutorialProgressRow;
    } else if (progress.status !== "completed") {
      const { data, error } = await supabase
        .from("tutorial_progress")
        .update({
          tutorial_type: definition.type,
          tutorial_version: definition.version,
          status: "skipped",
          completed_at: null,
          skipped_at: now,
        })
        .eq("id", progress.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Impossible d’ignorer le didacticiel : ${error.message}`,
        );
      }

      progress = data as TutorialProgressRow;
    }

    const activeSession = await getActiveTutorialSession(supabase, progress.id);

    const session = activeSession
      ? await finishSession({
          supabase,
          session: activeSession,
          status: "skipped",
          lastStepKey: activeSession.last_step_key,
        })
      : null;

    return {
      ok: true,
      progress,
      session,
      currentStepKey: progress.current_step_key,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function completeTutorialAction(
  input: unknown,
): Promise<TutorialActionResult> {
  try {
    const parsed = tutorialStepSchema.parse(input);

    const definition = requireTutorialDefinition(parsed.tutorialKey);

    requireTutorialStep(definition, parsed.stepKey, parsed.route);

    const supabase = await createSupabaseServerClient();

    let progress = await getAuthenticatedTutorialProgress(
      supabase,
      definition.key,
    );

    if (!progress) {
      throw new Error("Aucune progression n’existe pour ce didacticiel.");
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("tutorial_progress")
      .update({
        tutorial_type: definition.type,
        tutorial_version: definition.version,
        status: "completed",
        current_step_key: parsed.stepKey,
        current_route: parsed.route,
        started_at: progress.started_at ?? now,
        completed_at: now,
        skipped_at: null,
      })
      .eq("id", progress.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Impossible de terminer le didacticiel : ${error.message}`,
      );
    }

    progress = data as TutorialProgressRow;

    const activeSession = await getActiveTutorialSession(supabase, progress.id);

    const session = activeSession
      ? await finishSession({
          supabase,
          session: activeSession,
          status: "completed",
          lastStepKey: parsed.stepKey,
        })
      : null;

    return {
      ok: true,
      progress,
      session,
      currentStepKey: parsed.stepKey,
    };
  } catch (error) {
    return actionFailure(error);
  }
}
