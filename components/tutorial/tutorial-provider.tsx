"use client";

import {
  Suspense,
  type ReactNode,
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  completeTutorialAction,
  quitTutorialAction,
  setTutorialStepAction,
  skipTutorialAction,
  startTutorialAction,
} from "@/app/jeu/tutorial-actions";
import { useLocale } from "@/components/i18n/locale-provider";
import { selectInstantAutoStartTutorialKey } from "@/lib/tutorial/instant-start";
import {
  TutorialRequestTimeoutError,
  waitForTutorialRequest,
} from "@/lib/tutorial/client-request";
import {
  matchesTutorialRoute,
  resolveConcreteTutorialRoute,
} from "@/lib/tutorial/routes";
import type {
  ActiveTutorial,
  StartTutorialOptions,
  TutorialProgressRow,
  TutorialSessionLaunchSource,
} from "@/types/tutorial";

const TutorialInstantIntro = dynamic(() =>
  import("@/components/tutorial/tutorial-instant-intro").then(
    (module) => module.TutorialInstantIntro,
  ),
);

const TutorialOverlay = dynamic(() =>
  import("@/components/tutorial/tutorial-overlay").then(
    (module) => module.TutorialOverlay,
  ),
);

type TutorialClientRuntime = typeof import("@/lib/tutorial/client-runtime");

let tutorialClientRuntimePromise: Promise<TutorialClientRuntime> | null = null;

function loadTutorialClientRuntime(): Promise<TutorialClientRuntime> {
  tutorialClientRuntimePromise ??= import(
    "@/lib/tutorial/client-runtime"
  ).catch((error) => {
    tutorialClientRuntimePromise = null;
    throw error;
  });

  return tutorialClientRuntimePromise;
}

type TutorialContextValue = {
  activeTutorial: ActiveTutorial | null;

  progressByTutorialKey: Readonly<Record<string, TutorialProgressRow>>;

  isPending: boolean;
  errorMessage: string | null;

  startTutorial: (options: StartTutorialOptions) => Promise<boolean>;
  resumeActiveTutorial: () => boolean;

  previousStep: () => Promise<void>;
  nextStep: () => Promise<void>;
  quitTutorial: () => Promise<void>;
  skipTutorial: () => Promise<void>;

  getTutorialProgress: (tutorialKey: string) => TutorialProgressRow | null;

  clearTutorialError: () => void;
};

export type TutorialProviderBootstrap = {
  progress: TutorialProgressRow[];
  autoStartTutorialKeys: string[];
};

type TutorialProviderProps = {
  children: ReactNode;
  initialProgress?: readonly TutorialProgressRow[];
  autoStartTutorialKeys?: readonly string[];
  bootstrapPromise?: Promise<TutorialProviderBootstrap>;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

function createProgressMap(
  progressRows: readonly TutorialProgressRow[],
): Record<string, TutorialProgressRow> {
  return Object.fromEntries(
    progressRows.map((progress) => [progress.tutorial_key, progress]),
  );
}

function findStepIndex(
  activeTutorial: Pick<ActiveTutorial, "definition">,
  stepKey: string | null,
): number {
  if (!stepKey) {
    return 0;
  }

  const index = activeTutorial.definition.steps.findIndex(
    (step) => step.key === stepKey,
  );

  return index >= 0 ? index : 0;
}

function readTutorialTargetRoute(targetId?: string): string | null {
  if (!targetId || typeof document === "undefined") {
    return null;
  }

  const target = document.querySelector<HTMLElement>(
    `[data-tutorial-id="${targetId}"]`,
  );

  if (!target) {
    return null;
  }

  const route = target.dataset.tutorialRoute;

  if (route) {
    return route;
  }

  if (target instanceof HTMLAnchorElement) {
    const targetUrl = new URL(target.href, window.location.origin);
    return `${targetUrl.pathname}${targetUrl.search}`;
  }

  return null;
}

function resolveTutorialStepRoute({
  step,
  currentRoute,
  savedRoute,
}: {
  step: ActiveTutorial["definition"]["steps"][number];
  currentRoute: string;
  savedRoute?: string | null;
}): string | null {
  return resolveConcreteTutorialRoute({
    routePattern: step.route,
    candidates: [savedRoute, currentRoute, readTutorialTargetRoute(step.routeTargetId)],
  });
}

export function TutorialProvider({
  children,
  initialProgress = [],
  autoStartTutorialKeys = [],
  bootstrapPromise,
}: TutorialProviderProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRoute = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const autoStartAttemptedRef = useRef(false);

  const [resolvedAutoStartTutorialKeys, setResolvedAutoStartTutorialKeys] =
    useState<readonly string[]>(autoStartTutorialKeys);
  const autoStartTutorialKeySet = useMemo(
    () => new Set(resolvedAutoStartTutorialKeys),
    [resolvedAutoStartTutorialKeys],
  );
  const [bootstrapLoaded, setBootstrapLoaded] = useState(
    !bootstrapPromise && autoStartTutorialKeys.length === 0,
  );
  const [tutorialRuntime, setTutorialRuntime] =
    useState<TutorialClientRuntime | null>(null);

  const [progressByTutorialKey, setProgressByTutorialKey] = useState<
    Record<string, TutorialProgressRow>
  >(() => createProgressMap(initialProgress));

  const [activeTutorial, setActiveTutorial] = useState<ActiveTutorial | null>(
    null,
  );
  const activeDestinationRef = useRef<string | null>(null);

  const [isPending, setIsPending] = useState(false);
  const operationInFlightRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [instantAutoStartTutorialKey, setInstantAutoStartTutorialKey] =
    useState<string | null>(null);

  const beginOperation = useCallback(() => {
    if (operationInFlightRef.current) return false;
    operationInFlightRef.current = true;
    setIsPending(true);
    setErrorMessage(null);
    return true;
  }, []);

  const finishOperation = useCallback(() => {
    operationInFlightRef.current = false;
    setIsPending(false);
  }, []);

  const requestErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof TutorialRequestTimeoutError) {
      return isEnglish
        ? "The tutorial is taking too long to respond. Your progress may have been saved. Try resuming it."
        : "Le didacticiel met trop de temps à répondre. Votre progression a peut-être été enregistrée. Essayez de le reprendre.";
    }
    return error instanceof Error ? error.message : fallback;
  }, [isEnglish]);

  const loadAndStoreTutorialRuntime = useCallback(async () => {
    const runtime = await loadTutorialClientRuntime();
    setTutorialRuntime(runtime);
    return runtime;
  }, []);

  const hydrateTutorialBootstrap = useCallback(
    (bootstrap: TutorialProviderBootstrap) => {
      setProgressByTutorialKey(createProgressMap(bootstrap.progress));
      setResolvedAutoStartTutorialKeys(bootstrap.autoStartTutorialKeys);
      autoStartAttemptedRef.current = false;

      if (bootstrap.autoStartTutorialKeys.length === 0) {
        setInstantAutoStartTutorialKey(null);
        setBootstrapLoaded(true);
        return;
      }

      setBootstrapLoaded(false);

      void loadAndStoreTutorialRuntime()
        .then((runtime) => {
          setInstantAutoStartTutorialKey(
            selectInstantAutoStartTutorialKey({
              autoStartTutorialKeys: bootstrap.autoStartTutorialKeys,
              progressRows: bootstrap.progress,
              definitions: runtime.listAutoStartTutorialDefinitions(),
            }),
          );
          setBootstrapLoaded(true);
        })
        .catch((error) => {
          console.error(
            "Impossible de charger le moteur des didacticiels.",
            error,
          );
          setBootstrapLoaded(true);
        });
    },
    [loadAndStoreTutorialRuntime],
  );

  const initialBootstrapHandledRef = useRef(false);

  useEffect(() => {
    if (bootstrapPromise || initialBootstrapHandledRef.current) {
      return;
    }

    initialBootstrapHandledRef.current = true;
    hydrateTutorialBootstrap({
      progress: [...initialProgress],
      autoStartTutorialKeys: [...autoStartTutorialKeys],
    });
  }, [
    autoStartTutorialKeys,
    bootstrapPromise,
    hydrateTutorialBootstrap,
    initialProgress,
  ]);

  const saveProgress = useCallback((progress: TutorialProgressRow) => {
    setProgressByTutorialKey((current) => ({
      ...current,
      [progress.tutorial_key]: progress,
    }));
  }, []);

  const navigateToStep = useCallback(
    (routePattern: string, resolvedRoute: string) => {
      if (!matchesTutorialRoute(routePattern, currentRoute)) {
        router.push(resolvedRoute);
      }
    },
    [currentRoute, router],
  );

  // Only an explicit local return uses this destination. Route-driven resumes
  // must ask the server again: a registration or profile form may have advanced
  // its cursor while the same tutorial remained mounted in the layout.
  const resumeActiveTutorial = useCallback(() => {
    if (operationInFlightRef.current || !activeTutorial) return false;
    const step = activeTutorial.definition.steps[activeTutorial.currentStepIndex];
    const destination = step && resolveTutorialStepRoute({
      step, currentRoute, savedRoute: activeDestinationRef.current,
    });
    if (!destination) {
      setErrorMessage("La fiche à ouvrir pour cette étape est momentanément introuvable.");
      return false;
    }
    setErrorMessage(null);
    navigateToStep(step.route, destination);
    return true;
  }, [activeTutorial, currentRoute, navigateToStep]);

  const startTutorial = useCallback(
    async (options: StartTutorialOptions): Promise<boolean> => {
      if (!beginOperation()) return false;

      try {
        const runtime = await waitForTutorialRequest(loadAndStoreTutorialRuntime());
        const definition = runtime.getTutorialDefinition(options.tutorialKey);

        if (!definition) {
          setErrorMessage(
            isEnglish
              ? `Tutorial “${options.tutorialKey}” could not be found.`
              : `Le didacticiel « ${options.tutorialKey} » est introuvable.`,
          );

          return false;
        }

        const result = await waitForTutorialRequest(startTutorialAction({
          tutorialKey: options.tutorialKey,
          launchSource: options.launchSource,
          restartFromBeginning: options.restartFromBeginning ?? false,
        }));

        if (!result.ok) {
          setErrorMessage(result.error);
          return false;
        }

        const session = result.session;

        if (!session) {
          setErrorMessage(
            isEnglish
              ? "The tutorial session could not be created."
              : "La session du didacticiel n’a pas pu être créée.",
          );

          return false;
        }

        const stepIndex = findStepIndex({ definition }, result.currentStepKey);

        const step = definition.steps[stepIndex];

        if (!step) {
          setErrorMessage(
            isEnglish
              ? "No valid step is available for this tutorial."
              : "Aucune étape valide n’est disponible pour ce didacticiel.",
          );

          return false;
        }

        const resolvedRoute = resolveTutorialStepRoute({
          step,
          currentRoute,
          savedRoute: result.resolvedRoute,
        });

        if (!resolvedRoute) {
          setErrorMessage(
            "La fiche à ouvrir pour cette étape est momentanément introuvable.",
          );
          return false;
        }

        saveProgress(result.progress);

        setInstantAutoStartTutorialKey((currentKey) =>
          currentKey === definition.key ? null : currentKey,
        );

        activeDestinationRef.current = resolvedRoute;
        setActiveTutorial({
          definition,
          progress: result.progress,
          session,
          currentStepIndex: stepIndex,
        });

        navigateToStep(step.route, resolvedRoute);

        return true;
      } catch (error) {
        setErrorMessage(
          requestErrorMessage(error, "Impossible de démarrer le didacticiel."),
        );

        return false;
      } finally {
        finishOperation();
      }
    },
    [
      currentRoute,
      beginOperation,
      finishOperation,
      isEnglish,
      loadAndStoreTutorialRuntime,
      navigateToStep,
      saveProgress,
      requestErrorMessage,
    ],
  );

  const updateCurrentStep = useCallback(
    async (nextStepIndex: number): Promise<boolean> => {
      if (!activeTutorial) {
        return false;
      }

      const step = activeTutorial.definition.steps[nextStepIndex];

      if (!step) {
        return false;
      }

      const resolvedRoute = resolveTutorialStepRoute({
        step,
        currentRoute,
      });

      if (!resolvedRoute) {
        setErrorMessage(
          "La fiche à ouvrir pour cette étape est momentanément introuvable.",
        );
        return false;
      }

      if (!beginOperation()) return false;

      try {
        const result = await waitForTutorialRequest(setTutorialStepAction({
          tutorialKey: activeTutorial.definition.key,
          stepKey: step.key,
          route: resolvedRoute,
        }));

        if (!result.ok) {
          setErrorMessage(result.error);
          return false;
        }

        const updatedSession = result.session;

        if (!updatedSession) {
          setErrorMessage("La session active du didacticiel est introuvable.");

          return false;
        }

        const resolvedStepIndex = result.currentStepKey
          ? activeTutorial.definition.steps.findIndex(
              (candidate) => candidate.key === result.currentStepKey,
            )
          : nextStepIndex;
        const safeStepIndex =
          resolvedStepIndex >= 0 ? resolvedStepIndex : nextStepIndex;
        const resolvedStep =
          activeTutorial.definition.steps[safeStepIndex] ?? step;
        // Completed progress retains its historical finishing page on replay.
        // The server resolves the active session's destination separately.
        const navigationRoute = resolveTutorialStepRoute({
          step: resolvedStep,
          currentRoute: resolvedStep.key === step.key ? resolvedRoute : currentRoute,
          savedRoute: result.resolvedRoute,
        });

        if (!navigationRoute) {
          setErrorMessage("La fiche à ouvrir pour cette étape est momentanément introuvable.");
          return false;
        }

        saveProgress(result.progress);
        activeDestinationRef.current = navigationRoute;

        setActiveTutorial((current) => {
          if (!current || current.session.id !== activeTutorial.session.id) {
            return current;
          }

          return {
            ...current,
            progress: result.progress,
            session: updatedSession,
            currentStepIndex: safeStepIndex,
          };
        });

        navigateToStep(resolvedStep.route, navigationRoute);

        return true;
      } catch (error) {
        setErrorMessage(
          requestErrorMessage(error, "Impossible d’enregistrer cette étape."),
        );

        return false;
      } finally {
        finishOperation();
      }
    },
    [activeTutorial, beginOperation, currentRoute, finishOperation, navigateToStep, requestErrorMessage, saveProgress],
  );

  const previousStep = useCallback(async () => {
    if (!activeTutorial) {
      return;
    }

    const previousIndex = activeTutorial.currentStepIndex - 1;

    if (previousIndex < 0) {
      return;
    }

    await updateCurrentStep(previousIndex);
  }, [activeTutorial, updateCurrentStep]);

  const completeTutorial = useCallback(async (): Promise<boolean> => {
    if (!activeTutorial) {
      return false;
    }

    const currentStep =
      activeTutorial.definition.steps[activeTutorial.currentStepIndex];

    if (!currentStep) {
      return false;
    }

    if (!beginOperation()) return false;

    try {
      const result = await waitForTutorialRequest(completeTutorialAction({
        tutorialKey: activeTutorial.definition.key,
        stepKey: currentStep.key,
        route: currentStep.route,
      }));

      if (!result.ok) {
        setErrorMessage(result.error);
        return false;
      }

      saveProgress(result.progress);
      setActiveTutorial(null);
      router.refresh();

      return true;
    } catch (error) {
      setErrorMessage(
        requestErrorMessage(error, "Impossible de terminer le didacticiel."),
      );

      return false;
    } finally {
      finishOperation();
    }
  }, [activeTutorial, beginOperation, finishOperation, requestErrorMessage, router, saveProgress]);

  const continueToFollowUpTutorial = useCallback(async () => {
    const followUpTutorialKey = activeTutorial?.definition.followUpTutorialKey;

    if (!followUpTutorialKey) {
      return;
    }

    const completed = await completeTutorial();

    if (!completed) {
      return;
    }

    await startTutorial({
      tutorialKey: followUpTutorialKey,
      launchSource: "manual",
      restartFromBeginning: true,
    });
  }, [activeTutorial, completeTutorial, startTutorial]);

  const nextStep = useCallback(async () => {
    if (!activeTutorial) {
      return;
    }

    const nextIndex = activeTutorial.currentStepIndex + 1;

    if (nextIndex >= activeTutorial.definition.steps.length) {
      await completeTutorial();
      return;
    }

    await updateCurrentStep(nextIndex);
  }, [activeTutorial, completeTutorial, updateCurrentStep]);

  const quitTutorial = useCallback(async () => {
    if (!activeTutorial) {
      return;
    }

    const currentStep =
      activeTutorial.definition.steps[activeTutorial.currentStepIndex];

    if (!currentStep) {
      return;
    }

    if (!beginOperation()) return;
    // Pausing the local guide must remain possible even when the server cannot
    // acknowledge it. The last saved progress is kept for a later resume.
    setActiveTutorial(null);

    try {
      const result = await waitForTutorialRequest(quitTutorialAction({
        tutorialKey: activeTutorial.definition.key,
        stepKey: currentStep.key,
        route: currentStep.route,
      }));

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      saveProgress(result.progress);
      setActiveTutorial(null);
    } catch (error) {
      setErrorMessage(
        requestErrorMessage(error, "Impossible de quitter le didacticiel."),
      );
    } finally {
      finishOperation();
    }
  }, [activeTutorial, beginOperation, finishOperation, requestErrorMessage, saveProgress]);

  const skipTutorial = useCallback(async () => {
    if (!activeTutorial) {
      return;
    }

    const confirmed = window.confirm(
      "Passer le didacticiel ?\n\nIl ne sera plus proposé automatiquement, mais restera disponible depuis le Guide.",
    );

    if (!confirmed) {
      return;
    }

    if (!beginOperation()) return;

    try {
      const result = await waitForTutorialRequest(skipTutorialAction({
        tutorialKey: activeTutorial.definition.key,
      }));

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      saveProgress(result.progress);
      setActiveTutorial(null);
    } catch (error) {
      setErrorMessage(
        requestErrorMessage(error, "Impossible d’ignorer le didacticiel."),
      );
    } finally {
      finishOperation();
    }
  }, [activeTutorial, beginOperation, finishOperation, requestErrorMessage, saveProgress]);

  const getTutorialProgress = useCallback(
    (tutorialKey: string): TutorialProgressRow | null =>
      progressByTutorialKey[tutorialKey] ?? null,
    [progressByTutorialKey],
  );

  const clearTutorialError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const startInstantAutoStartTutorial = useCallback(() => {
    if (!instantAutoStartTutorialKey) {
      return;
    }

    const progress = progressByTutorialKey[instantAutoStartTutorialKey];

    const launchSource: TutorialSessionLaunchSource =
      progress?.status === "in_progress" ? "resume" : "automatic";

    autoStartAttemptedRef.current = true;

    void startTutorial({
      tutorialKey: instantAutoStartTutorialKey,
      launchSource,
      restartFromBeginning: false,
    });
  }, [instantAutoStartTutorialKey, progressByTutorialKey, startTutorial]);

  const skipInstantAutoStartTutorial = useCallback(async () => {
    if (!instantAutoStartTutorialKey) {
      return;
    }

    const confirmed = window.confirm(
      "Passer le didacticiel ?\n\nIl ne sera plus proposé automatiquement, mais restera disponible depuis le Guide.",
    );

    if (!confirmed) {
      return;
    }

    autoStartAttemptedRef.current = true;
    if (!beginOperation()) return;

    try {
      const result = await waitForTutorialRequest(skipTutorialAction({
        tutorialKey: instantAutoStartTutorialKey,
      }));

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      saveProgress(result.progress);
      setInstantAutoStartTutorialKey(null);
    } catch (error) {
      setErrorMessage(
        requestErrorMessage(error, "Impossible d’ignorer le didacticiel."),
      );
    } finally {
      finishOperation();
    }
  }, [beginOperation, finishOperation, instantAutoStartTutorialKey, requestErrorMessage, saveProgress]);

  useEffect(() => {
    if (
      !bootstrapLoaded ||
      autoStartAttemptedRef.current ||
      activeTutorial ||
      isPending
    ) {
      return;
    }

    if (!tutorialRuntime) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      autoStartAttemptedRef.current = true;

      const definition = tutorialRuntime
        .listAutoStartTutorialDefinitions()
        .filter((candidate) => autoStartTutorialKeySet.has(candidate.key))
        .find((candidate) => {
          const progress = progressByTutorialKey[candidate.key];

          return (
            !progress ||
            progress.status === "not_started" ||
            progress.status === "in_progress"
          );
        });

      if (!definition) {
        return;
      }

      const progress = progressByTutorialKey[definition.key];

      const launchSource: TutorialSessionLaunchSource =
        progress?.status === "in_progress" ? "resume" : "automatic";

      void startTutorial({
        tutorialKey: definition.key,
        launchSource,
        restartFromBeginning: false,
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTutorial,
    autoStartTutorialKeySet,
    bootstrapLoaded,
    isPending,
    progressByTutorialKey,
    startTutorial,
    tutorialRuntime,
  ]);

  const localizedActiveTutorial = useMemo<ActiveTutorial | null>(
    () =>
      activeTutorial
        ? {
            ...activeTutorial,
            definition: tutorialRuntime?.localizeTutorialDefinition(
              activeTutorial.definition,
              locale,
            ) ?? activeTutorial.definition,
          }
        : null,
    [activeTutorial, locale, tutorialRuntime],
  );

  const contextValue = useMemo<TutorialContextValue>(
    () => ({
      activeTutorial: localizedActiveTutorial,
      progressByTutorialKey,
      isPending,
      errorMessage,
      startTutorial,
      resumeActiveTutorial,
      previousStep,
      nextStep,
      quitTutorial,
      skipTutorial,
      getTutorialProgress,
      clearTutorialError,
    }),
    [
      localizedActiveTutorial,
      progressByTutorialKey,
      isPending,
      errorMessage,
      startTutorial,
      resumeActiveTutorial,
      previousStep,
      nextStep,
      quitTutorial,
      skipTutorial,
      getTutorialProgress,
      clearTutorialError,
    ],
  );

  const instantAutoStartDefinition = useMemo(() => {
    const definition = instantAutoStartTutorialKey && tutorialRuntime
      ? tutorialRuntime.getTutorialDefinition(instantAutoStartTutorialKey)
      : null;

    return definition
      ? tutorialRuntime?.localizeTutorialDefinition(definition, locale) ?? null
      : null;
  }, [instantAutoStartTutorialKey, locale, tutorialRuntime]);

  const instantAutoStartStep = instantAutoStartDefinition?.steps[0] ?? null;

  const shouldDisplayInstantIntro =
    !activeTutorial &&
    Boolean(instantAutoStartDefinition) &&
    Boolean(instantAutoStartStep) &&
    matchesTutorialRoute(instantAutoStartStep?.route ?? "", currentRoute);

  const currentStep =
    localizedActiveTutorial?.definition.steps[
      localizedActiveTutorial.currentStepIndex
    ] ?? null;

  const shouldDisplayOverlay =
    Boolean(activeTutorial) &&
    Boolean(currentStep) &&
    matchesTutorialRoute(currentStep?.route ?? "", currentRoute);

  const followUpDefinition = useMemo(() => {
    const followUpKey = activeTutorial?.definition.followUpTutorialKey;
    const definition = followUpKey && tutorialRuntime
      ? tutorialRuntime.getTutorialDefinition(followUpKey)
      : null;

    return definition
      ? tutorialRuntime?.localizeTutorialDefinition(definition, locale) ?? null
      : null;
  }, [activeTutorial?.definition.followUpTutorialKey, locale, tutorialRuntime]);

  return (
    <TutorialContext.Provider value={contextValue}>
      {bootstrapPromise ? (
        <Suspense fallback={null}>
          <TutorialBootstrapHydrator
            bootstrapPromise={bootstrapPromise}
            onLoaded={hydrateTutorialBootstrap}
          />
        </Suspense>
      ) : null}

      {instantAutoStartDefinition &&
      instantAutoStartStep &&
      shouldDisplayInstantIntro ? (
        <TutorialInstantIntro
          tutorialTitle={instantAutoStartDefinition.title}
          step={instantAutoStartStep}
          isPending={isPending}
          errorMessage={errorMessage}
          onStart={startInstantAutoStartTutorial}
          onSkip={() => {
            void skipInstantAutoStartTutorial();
          }}
        />
      ) : null}

      {children}

      {!shouldDisplayOverlay && !shouldDisplayInstantIntro && (localizedActiveTutorial || errorMessage) ? (
        <aside
          aria-label={isEnglish ? "Tutorial status" : "État du didacticiel"}
          className="fixed inset-x-4 bottom-24 z-[120] rounded-2xl border border-[#278B70]/30 bg-[#FFFDF4] p-4 text-[#183F37] shadow-xl sm:left-auto sm:right-6 sm:max-w-sm"
        >
          {localizedActiveTutorial ? (
            <>
              <p className="text-sm font-black">{localizedActiveTutorial.definition.title}</p>
              <p className="mt-1 text-xs leading-5">
                {isEnglish ? "Return to the current step to continue your tutorial." : "Revenez à l’étape en cours pour poursuivre votre didacticiel."}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={resumeActiveTutorial}
                  className="min-h-10 flex-1 rounded-xl bg-[#176951] px-4 text-xs font-black text-white disabled:opacity-55"
                >
                  {isEnglish ? "Resume tutorial" : "Reprendre le didacticiel"}
                </button>
                <button type="button" disabled={isPending} onClick={() => void quitTutorial()} className="min-h-10 rounded-xl border border-[#315B3E]/20 px-3 text-xs font-bold disabled:opacity-55">
                  {isEnglish ? "Pause" : "Mettre en pause"}
                </button>
              </div>
            </>
          ) : null}
          {errorMessage ? (
            <div className={localizedActiveTutorial ? "mt-3" : ""}>
              <p role="alert" className="text-sm font-bold text-[#8B302E]">{errorMessage}</p>
              <button type="button" onClick={clearTutorialError} className="mt-2 min-h-9 text-xs font-bold underline">
                {isEnglish ? "Dismiss" : "Fermer"}
              </button>
            </div>
          ) : null}
        </aside>
      ) : null}

      {localizedActiveTutorial && currentStep && shouldDisplayOverlay ? (
        <TutorialOverlay
          tutorialTitle={localizedActiveTutorial.definition.title}
          presentation={
            localizedActiveTutorial.definition.type === "onboarding" ||
            localizedActiveTutorial.definition.type === "race_scenario"
              ? "informative"
              : "focused"
          }
          step={currentStep}
          stepIndex={localizedActiveTutorial.currentStepIndex}
          totalSteps={localizedActiveTutorial.definition.steps.length}
          canGoPrevious={localizedActiveTutorial.currentStepIndex > 0}
          isLastStep={
            localizedActiveTutorial.currentStepIndex ===
            localizedActiveTutorial.definition.steps.length - 1
          }
          isPending={isPending}
          errorMessage={errorMessage}
          followUpLabel={
            followUpDefinition
              ? isEnglish
                ? `Continue with “${followUpDefinition.title}”`
                : `Enchaîner avec « ${followUpDefinition.title} »`
              : undefined
          }
          onPrevious={() => {
            void previousStep();
          }}
          onNext={() => {
            void nextStep();
          }}
          onQuit={() => {
            void quitTutorial();
          }}
          onSkip={() => {
            void skipTutorial();
          }}
          onFollowUp={
            followUpDefinition
              ? () => {
                  void continueToFollowUpTutorial();
                }
              : undefined
          }
        />
      ) : null}
    </TutorialContext.Provider>
  );
}

function TutorialBootstrapHydrator({
  bootstrapPromise,
  onLoaded,
}: {
  bootstrapPromise: Promise<TutorialProviderBootstrap>;
  onLoaded: (bootstrap: TutorialProviderBootstrap) => void;
}) {
  const bootstrap = use(bootstrapPromise);

  useEffect(() => {
    onLoaded(bootstrap);
  }, [bootstrap, onLoaded]);

  return null;
}

export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);

  if (!context) {
    throw new Error(
      "useTutorial doit être utilisé à l’intérieur de TutorialProvider.",
    );
  }

  return context;
}
