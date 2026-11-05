"use server";

import { z } from "zod";
import { unstable_rethrow } from "next/navigation";

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
  hasDynamicTutorialRouteSegment,
  materializeTutorialRoute,
  matchesTutorialRoute,
  resolveTutorialProgressRoute,
} from "@/lib/tutorial/routes";
import {
  ROSTER_TUTORIAL_KEY,
  ROSTER_TUTORIAL_RIDER_ROUTE,
} from "@/lib/tutorial/roster";
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
  resolvedRoute: string | null;
};

type TutorialActionFailure = {
  ok: false;
  error: string;
};

type TutorialActionResult = TutorialActionSuccess | TutorialActionFailure;

type TutorialRosterRow = { rider_id: string };

const PROGRESS_COLUMNS = "id,sporting_director_id,tutorial_key,tutorial_type,tutorial_version,status,current_step_key,current_route,started_at,completed_at,skipped_at,created_at,updated_at";
const SESSION_COLUMNS = "id,tutorial_progress_id,tutorial_version,launch_source,status,first_step_key,last_step_key,started_at,ended_at,created_at,updated_at";
type TutorialClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const deadlines = new WeakMap<TutorialClient, AbortSignal>();
const directorIds = new WeakMap<TutorialClient, string>();
const registrationReads = new WeakMap<TutorialClient, Map<string, Promise<boolean>>>();
const onboardingReads = new WeakMap<TutorialClient, ReturnType<typeof getAuthenticatedTutorialOnboardingState>>();

async function createTutorialClient() {
  const supabase = await createSupabaseServerClient();
  deadlines.set(supabase, AbortSignal.timeout(8_000));
  registrationReads.delete(supabase);
  onboardingReads.delete(supabase);
  directorIds.delete(supabase);
  return supabase;
}

function deadline(supabase: TutorialClient) {
  return deadlines.get(supabase)!;
}

async function readProgress(supabase: TutorialClient, tutorialKey: string) {
  const progress = await getAuthenticatedTutorialProgress(supabase, tutorialKey, {
    includeMetadata: false, signal: deadline(supabase), sportingDirectorId: directorIds.get(supabase),
  });
  if (progress) directorIds.set(supabase, progress.sporting_director_id);
  return progress;
}

function clientProgress(progress: TutorialProgressRow): TutorialProgressRow {
  return {...progress, metadata: {}};
}

function readOnboardingState(supabase: TutorialClient) {
  let result = onboardingReads.get(supabase);
  if (!result) {
    result = getAuthenticatedTutorialOnboardingState(supabase, deadline(supabase));
    onboardingReads.set(supabase, result);
  }
  return result;
}

/** Read only registration evidence; the simulation timeline never crosses this boundary. */
function hasCriteriumRegistration(supabase: TutorialClient, progress: TutorialProgressRow): Promise<boolean> {
  let reads = registrationReads.get(supabase);
  if (!reads) { reads = new Map(); registrationReads.set(supabase, reads); }
  const existing = reads.get(progress.id);
  if (existing) return existing;
  const result = (async () => {
    const {data, error} = await supabase.from("tutorial_progress").select([
      "version:metadata->criteriumDiscoveryRun->version",
      "registeredAt:metadata->criteriumDiscoveryRun->registeredAt",
      "roster:metadata->criteriumDiscoveryRun->roster",
      "slug:metadata->criteriumDiscoveryRun->edition->slug",
      "stageId:metadata->criteriumDiscoveryRun->lockedSimulation->stageId",
      "raceEditionId:metadata->criteriumDiscoveryRun->lockedSimulation->raceEditionId",
      "inputSeed:metadata->criteriumDiscoveryRun->lockedSimulation->input->seed",
      "simulationSeed:metadata->criteriumDiscoveryRun->lockedSimulation->simulation->seed",
      "simulationStageId:metadata->criteriumDiscoveryRun->lockedSimulation->simulation->stageId",
    ].join(",")).eq("id", progress.id).abortSignal(deadline(supabase)).maybeSingle();
    if (error) throw new Error("Impossible de vérifier l’inscription au Critérium. Réessayez dans un instant.");
    const row = data as Record<string, unknown> | null;
    if (!row || typeof row.simulationSeed !== "string" || row.simulationSeed.length === 0 ||
      (typeof row.inputSeed !== "string" && typeof row.inputSeed !== "number") ||
      String(row.inputSeed) !== row.simulationSeed || row.simulationStageId !== row.stageId) return false;
    return Boolean(getCriteriumDiscoveryRunFromMetadata({criteriumDiscoveryRun: {
      version: row.version, registeredAt: row.registeredAt, roster: row.roster,
      edition: {slug: row.slug}, lockedSimulation: {stageId: row.stageId, raceEditionId: row.raceEditionId,
        input: {seed: row.inputSeed}, simulation: {seed: row.simulationSeed}},
    }}));
  })();
  reads.set(progress.id, result);
  return result;
}

function actionFailure(error: unknown): TutorialActionFailure {
  unstable_rethrow(error);
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError" || /\b(?:AbortError|TimeoutError)\b/.test(error.message)) {
      return {ok: false, error: "La demande a pris trop de temps. Votre progression est conservée ; reprenez le didacticiel pour continuer."};
    }
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

async function resolveTutorialStepRouteForDirector({
  supabase,
  definition,
  step,
  route,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  definition: TutorialDefinition;
  step: TutorialStep;
  route: string;
}): Promise<string> {
  if (!hasDynamicTutorialRouteSegment(route)) {
    return route;
  }

  if (
    definition.key !== ROSTER_TUTORIAL_KEY ||
    step.route !== ROSTER_TUTORIAL_RIDER_ROUTE
  ) {
    throw new Error(
      `La route dynamique de l’étape « ${step.key} » ne peut pas être résolue.`,
    );
  }

  const { data, error } = await supabase.rpc("get_current_team_roster").abortSignal(deadline(supabase));

  if (error) {
    throw new Error(
      `Impossible de retrouver un coureur pour reprendre le didacticiel : ${error.message}`,
    );
  }

  const riderId = ((data ?? []) as TutorialRosterRow[])[0]?.rider_id;
  const resolvedRoute = materializeTutorialRoute({
    routePattern: step.route,
    segmentValues: { identifiant: riderId },
  });

  if (!resolvedRoute) {
    throw new Error(
      "Ajoutez au moins un coureur à votre effectif avant de poursuivre ce didacticiel.",
    );
  }

  return resolvedRoute;
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
    const progress = await readProgress(
      supabase,
      CRITERIUM_DISCOVERY_KEY,
    );

    if (!progress || !await hasCriteriumRegistration(supabase, progress)) {
      throw new Error(
        "Validez d’abord l’inscription de vos cinq coureurs avant de poursuivre vers le Live.",
      );
    }

    return;
  }

  const state = await readOnboardingState(supabase);

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
      if (!await hasCriteriumRegistration(supabase, progress)) {
        return candidate;
      }

      continue;
    }

    onboardingStatePromise ??=
      readOnboardingState(supabase);
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
  if (progress.current_step_key === stepKey && progress.current_route === route && progress.tutorial_version === definition.version) return progress;

  const { data, error } = await supabase
    .from("tutorial_progress")
    .update({
      tutorial_version: definition.version,
      current_step_key: stepKey,
      current_route: route,
    })
    .eq("id", progress.id)
    .eq("status", "in_progress")
    .eq("updated_at", progress.updated_at)
    .select(PROGRESS_COLUMNS)
    .abortSignal(deadline(supabase))
    .maybeSingle();

  if (error) {
    throw new Error(
      `Impossible d’enregistrer l’étape du didacticiel : ${error.message}`,
    );
  }

  if (!data) {
    const latest = await readProgress(supabase, definition.key);
    if (latest?.status === "completed" || latest?.status === "skipped") return latest;
    throw new Error("La progression a changé dans une autre fenêtre. Reprenez le didacticiel pour continuer.");
  }
  return {...data, metadata: {}} as TutorialProgressRow;
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
  if (session.last_step_key === stepKey && session.tutorial_version === definition.version) return session;
  const { data, error } = await supabase
    .from("tutorial_sessions")
    .update({
      tutorial_version: definition.version,
      last_step_key: stepKey,
    })
    .eq("id", session.id)
    .eq("status", "in_progress")
    .eq("updated_at", session.updated_at)
    .select(SESSION_COLUMNS)
    .abortSignal(deadline(supabase))
    .maybeSingle();

  if (error) {
    throw new Error(
      `Impossible d’enregistrer la session du didacticiel : ${error.message}`,
    );
  }

  if (!data) throw new Error("Cette session a changé dans une autre fenêtre. Reprenez le didacticiel pour continuer.");
  return {...data, metadata: {}} as TutorialSessionRow;
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
    .eq("status", "in_progress")
    .select(SESSION_COLUMNS)
    .abortSignal(deadline(supabase))
    .maybeSingle();

  if (error) {
    throw new Error(
      `Impossible de terminer la session du didacticiel : ${error.message}`,
    );
  }

  if (!data) {
    const {data: latest, error: readError} = await supabase.from("tutorial_sessions")
      .select(SESSION_COLUMNS).eq("id", session.id).abortSignal(deadline(supabase)).maybeSingle();
    if (readError || !latest) throw new Error("La session n’a pas pu être confirmée. Reprenez le didacticiel.");
    return {...latest, metadata: {}} as TutorialSessionRow;
  }
  return {...data, metadata: {}} as TutorialSessionRow;
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
    .select(SESSION_COLUMNS)
    .abortSignal(deadline(supabase))
        .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await getActiveTutorialSession(supabase, progress.id, deadline(supabase));
      if (existing) return existing;
    }
    throw new Error(
      `Impossible de démarrer la session du didacticiel : ${error.message}`,
    );
  }

  return {...data, metadata: {}} as TutorialSessionRow;
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

    const supabase = await createTutorialClient();

    const sportingDirectorId =
      await requireAuthenticatedSportingDirectorId(supabase, deadline(supabase));
    directorIds.set(supabase, sportingDirectorId);

    let progress = await readProgress(
      supabase,
      definition.key,
    );

    const now = new Date().toISOString();
    const initialStep = getInitialStep(definition);

    if (!progress) {
      await requireTutorialStepRequirement({supabase, step: initialStep});
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
        .select(PROGRESS_COLUMNS)
        .abortSignal(deadline(supabase))
        .single();

      if (error && error.code !== "23505") {
        throw new Error(
          `Impossible de créer la progression du didacticiel : ${error.message}`,
        );
      }

      progress = data ? {...data, metadata: {}} as TutorialProgressRow : await readProgress(supabase, definition.key);
      if (!progress) throw new Error("Le lancement n’a pas pu être confirmé. Réessayez dans un instant.");
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
    let selectedRoute = resolveTutorialProgressRoute({
      routePattern: selectedStep.route,
      savedRoute: progress.current_route,
      preserveSavedRoute:
        !parsed.restartFromBeginning &&
        progress.current_step_key === selectedStep.key,
    });
    selectedRoute = await resolveTutorialStepRouteForDirector({
      supabase,
      definition,
      step: selectedStep,
      route: selectedRoute,
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
        .eq("status", "not_started")
        .select(PROGRESS_COLUMNS)
        .abortSignal(deadline(supabase))
        .maybeSingle();

      if (error) {
        throw new Error(
          `Impossible de démarrer le didacticiel : ${error.message}`,
        );
      }

      progress = data ? {...data, metadata: {}} as TutorialProgressRow : await readProgress(supabase, definition.key);
      if (!progress) throw new Error("Le lancement n’a pas pu être confirmé. Reprenez le didacticiel.");
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
      ).abortSignal(deadline(supabase));

      if (giftError) {
        throw new Error(
          "Impossible de remettre les Lunettes didactiques : " +
            giftError.message,
        );
      }

      progress =
        (await readProgress(supabase, definition.key)) ??
        progress;
    }

    let session = await getActiveTutorialSession(supabase, progress.id, deadline(supabase));

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
      progress: clientProgress(progress),
      session,
      currentStepKey: selectedStep.key,
      resolvedRoute: selectedRoute,
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

    const supabase = await createTutorialClient();

    const now = new Date().toISOString();

    let progress = await readProgress(
      supabase,
      definition.key,
    );

    if (!progress) {
      await requireTutorialStepRequirement({supabase, step: requestedStep});
      const sportingDirectorId =
        await requireAuthenticatedSportingDirectorId(supabase, deadline(supabase));

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
        .select(PROGRESS_COLUMNS)
        .abortSignal(deadline(supabase))
        .single();

      if (error && error.code !== "23505") {
        throw new Error(
          `Impossible de créer la progression du didacticiel : ${error.message}`,
        );
      }

      progress = data ? {...data, metadata: {}} as TutorialProgressRow : await readProgress(supabase, definition.key);
      if (!progress) throw new Error("La progression n’a pas pu être confirmée. Reprenez le didacticiel.");
    }

    const step = await getFirstIncompleteStep({
      supabase,
      definition,
      startingStep: requestedStep,
      progress,
    });
    let stepRoute =
      step.key === requestedStep.key ? parsed.route : step.route;
    stepRoute = await resolveTutorialStepRouteForDirector({
      supabase,
      definition,
      step,
      route: stepRoute,
    });

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
        .eq("status", "not_started")
        .select(PROGRESS_COLUMNS)
        .abortSignal(deadline(supabase))
        .maybeSingle();

      if (error) {
        throw new Error(
          `Impossible de relancer le didacticiel : ${error.message}`,
        );
      }

      progress = data ? {...data, metadata: {}} as TutorialProgressRow : await readProgress(supabase, definition.key);
      if (!progress) throw new Error("La progression n’a pas pu être confirmée. Reprenez le didacticiel.");
    }

    let session = await getActiveTutorialSession(supabase, progress.id, deadline(supabase));

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
      progress: clientProgress(progress),
      session: updatedSession,
      currentStepKey: step.key,
      resolvedRoute: stepRoute,
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

    const supabase = await createTutorialClient();

    let progress = await readProgress(
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

    const activeSession = await getActiveTutorialSession(supabase, progress.id, deadline(supabase));

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
      progress: clientProgress(progress),
      session,
      currentStepKey: parsed.stepKey,
      resolvedRoute: null,
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

    const supabase = await createTutorialClient();

    const sportingDirectorId =
      await requireAuthenticatedSportingDirectorId(supabase, deadline(supabase));

    let progress = await readProgress(
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
        .select(PROGRESS_COLUMNS)
        .abortSignal(deadline(supabase))
        .single();

      if (error && error.code !== "23505") {
        throw new Error(
          `Impossible d’ignorer le didacticiel : ${error.message}`,
        );
      }

      progress = data ? {...data, metadata: {}} as TutorialProgressRow : await readProgress(supabase, definition.key);
      if (!progress) throw new Error("La progression n’a pas pu être confirmée. Réessayez dans un instant.");
    }
    if (progress.status !== "completed" && progress.status !== "skipped") {
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
        .neq("status", "completed")
        .eq("updated_at", progress.updated_at)
        .select(PROGRESS_COLUMNS)
        .abortSignal(deadline(supabase))
        .maybeSingle();

      if (error) {
        throw new Error(
          `Impossible d’ignorer le didacticiel : ${error.message}`,
        );
      }

      progress = data ? {...data, metadata: {}} as TutorialProgressRow : await readProgress(supabase, definition.key);
      if (!progress || (progress.status !== "completed" && progress.status !== "skipped")) throw new Error("La progression a changé dans une autre fenêtre. Reprenez le didacticiel.");
    }

    const activeSession = await getActiveTutorialSession(supabase, progress.id, deadline(supabase));

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
      progress: clientProgress(progress),
      session,
      currentStepKey: progress.current_step_key,
      resolvedRoute: null,
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

    const supabase = await createTutorialClient();

    let progress = await readProgress(
      supabase,
      definition.key,
    );

    if (!progress) {
      throw new Error("Aucune progression n’existe pour ce didacticiel.");
    }

    const now = new Date().toISOString();

    if (progress.status !== "completed") {
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
      .neq("status", "completed")
      .eq("updated_at", progress.updated_at)
      .select(PROGRESS_COLUMNS)
      .abortSignal(deadline(supabase))
      .maybeSingle();

    if (error) {
      throw new Error(
        `Impossible de terminer le didacticiel : ${error.message}`,
      );
    }

    progress = data ? {...data, metadata: {}} as TutorialProgressRow : await readProgress(supabase, definition.key);
    if (!progress || progress.status !== "completed") throw new Error("La progression a changé dans une autre fenêtre. Reprenez le didacticiel.");
    }

    const activeSession = await getActiveTutorialSession(supabase, progress.id, deadline(supabase));

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
      progress: clientProgress(progress),
      session,
      currentStepKey: parsed.stepKey,
      resolvedRoute: null,
    };
  } catch (error) {
    return actionFailure(error);
  }
}
