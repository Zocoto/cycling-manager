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
  hasDynamicTutorialRouteSegment,
  matchesTutorialRoute,
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
  const candidates = [
    savedRoute,
    currentRoute,
    readTutorialTargetRoute(step.routeTargetId),
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      !hasDynamicTutorialRouteSegment(candidate) &&
      matchesTutorialRoute(step.route, candidate)
    ) {
      return candidate;
    }
  }

  return hasDynamicTutorialRouteSegment(step.route) ? null : step.route;
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

  const [isPending, setIsPending] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [instantAutoStartTutorialKey, setInstantAutoStartTutorialKey] =
    useState<string | null>(null);

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

  const startTutorial = useCallback(
    async (options: StartTutorialOptions): Promise<boolean> => {
      setIsPending(true);
      setErrorMessage(null);

      try {
        const runtime = await loadAndStoreTutorialRuntime();
        const definition = runtime.getTutorialDefinition(options.tutorialKey);

        if (!definition) {
          setErrorMessage(
            isEnglish
              ? `Tutorial “${options.tutorialKey}” could not be found.`
              : `Le didacticiel « ${options.tutorialKey} » est introuvable.`,
          );

          return false;
        }

        const result = await startTutorialAction({
          tutorialKey: options.tutorialKey,
          launchSource: options.launchSource,
          restartFromBeginning: options.restartFromBeginning ?? false,
        });

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
          savedRoute: result.progress.current_route,
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
          error instanceof Error
            ? error.message
            : "Impossible de démarrer le didacticiel.",
        );

        return false;
      } finally {
        setIsPending(false);
      }
    },
    [
      currentRoute,
      isEnglish,
      loadAndStoreTutorialRuntime,
      navigateToStep,
      saveProgress,
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

      setIsPending(true);
      setErrorMessage(null);

      try {
        const result = await setTutorialStepAction({
          tutorialKey: activeTutorial.definition.key,
          stepKey: step.key,
          route: resolvedRoute,
        });

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
        const persistedRoute =
          result.progress.current_route ?? resolvedStep.route;

        saveProgress(result.progress);

        setActiveTutorial((current) => {
          if (!current) {
            return null;
          }

          return {
            ...current,
            progress: result.progress,
            session: updatedSession,
            currentStepIndex: safeStepIndex,
          };
        });

        navigateToStep(resolvedStep.route, persistedRoute);

        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible d’enregistrer cette étape.",
        );

        return false;
      } finally {
        setIsPending(false);
      }
    },
    [activeTutorial, currentRoute, navigateToStep, saveProgress],
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

    setIsPending(true);
    setErrorMessage(null);

    try {
      const result = await completeTutorialAction({
        tutorialKey: activeTutorial.definition.key,
        stepKey: currentStep.key,
        route: currentStep.route,
      });

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
        error instanceof Error
          ? error.message
          : "Impossible de terminer le didacticiel.",
      );

      return false;
    } finally {
      setIsPending(false);
    }
  }, [activeTutorial, router, saveProgress]);

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

    setIsPending(true);
    setErrorMessage(null);

    try {
      const result = await quitTutorialAction({
        tutorialKey: activeTutorial.definition.key,
        stepKey: currentStep.key,
        route: currentStep.route,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      saveProgress(result.progress);
      setActiveTutorial(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de quitter le didacticiel.",
      );
    } finally {
      setIsPending(false);
    }
  }, [activeTutorial, saveProgress]);

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

    setIsPending(true);
    setErrorMessage(null);

    try {
      const result = await skipTutorialAction({
        tutorialKey: activeTutorial.definition.key,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      saveProgress(result.progress);
      setActiveTutorial(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’ignorer le didacticiel.",
      );
    } finally {
      setIsPending(false);
    }
  }, [activeTutorial, saveProgress]);

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
    setIsPending(true);
    setErrorMessage(null);

    try {
      const result = await skipTutorialAction({
        tutorialKey: instantAutoStartTutorialKey,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      saveProgress(result.progress);
      setInstantAutoStartTutorialKey(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’ignorer le didacticiel.",
      );
    } finally {
      setIsPending(false);
    }
  }, [instantAutoStartTutorialKey, saveProgress]);

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
