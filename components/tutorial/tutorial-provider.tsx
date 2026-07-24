"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  completeTutorialAction,
  quitTutorialAction,
  setTutorialStepAction,
  skipTutorialAction,
  startTutorialAction,
} from "@/app/jeu/tutorial-actions";
import { TutorialInstantIntro } from "@/components/tutorial/tutorial-instant-intro";
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay";
import {
  getTutorialDefinition,
  listAutoStartTutorialDefinitions,
} from "@/lib/tutorial/catalog";
import { selectInstantAutoStartTutorialKey } from "@/lib/tutorial/instant-start";
import type {
  ActiveTutorial,
  StartTutorialOptions,
  TutorialProgressRow,
  TutorialSessionLaunchSource,
} from "@/types/tutorial";

type TutorialContextValue = {
  activeTutorial: ActiveTutorial | null;

  progressByTutorialKey: Readonly<
    Record<string, TutorialProgressRow>
  >;

  isPending: boolean;
  errorMessage: string | null;

  startTutorial: (
    options: StartTutorialOptions,
  ) => Promise<boolean>;

  previousStep: () => Promise<void>;
  nextStep: () => Promise<void>;
  quitTutorial: () => Promise<void>;
  skipTutorial: () => Promise<void>;

  getTutorialProgress: (
    tutorialKey: string,
  ) => TutorialProgressRow | null;

  clearTutorialError: () => void;

  synchronizeTutorialProgress: (
    progress: TutorialProgressRow,
  ) => void;
};

type TutorialProviderProps = {
  children: ReactNode;
  initialProgress?: readonly TutorialProgressRow[];
  autoStartTutorialKeys?: readonly string[];
};

const TutorialContext =
  createContext<TutorialContextValue | null>(null);

function createProgressMap(
  progressRows: readonly TutorialProgressRow[],
): Record<string, TutorialProgressRow> {
  return Object.fromEntries(
    progressRows.map((progress) => [
      progress.tutorial_key,
      progress,
    ]),
  );
}

function findStepIndex(
  activeTutorial: Pick<
    ActiveTutorial,
    "definition"
  >,
  stepKey: string | null,
): number {
  if (!stepKey) {
    return 0;
  }

  const index =
    activeTutorial.definition.steps.findIndex(
      (step) => step.key === stepKey,
    );

  return index >= 0 ? index : 0;
}

export function TutorialProvider({
  children,
  initialProgress = [],
  autoStartTutorialKeys = [],
}: TutorialProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const autoStartAttemptedRef =
    useRef(false);

  const autoStartTutorialKeySet =
    useMemo(
      () => new Set(autoStartTutorialKeys),
      [autoStartTutorialKeys],
    );

  const [
    progressByTutorialKey,
    setProgressByTutorialKey,
  ] = useState<
    Record<string, TutorialProgressRow>
  >(() => createProgressMap(initialProgress));

  const [
    activeTutorial,
    setActiveTutorial,
  ] = useState<ActiveTutorial | null>(null);

  const [isPending, setIsPending] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const [
    instantAutoStartTutorialKey,
    setInstantAutoStartTutorialKey,
  ] = useState<string | null>(() =>
    selectInstantAutoStartTutorialKey({
      autoStartTutorialKeys,
      progressRows: initialProgress,
      definitions:
        listAutoStartTutorialDefinitions(),
    }),
  );

  const saveProgress = useCallback(
    (progress: TutorialProgressRow) => {
      setProgressByTutorialKey((current) => ({
        ...current,
        [progress.tutorial_key]: progress,
      }));
    },
    [],
  );

  const navigateToStep = useCallback(
    (route: string) => {
      if (pathname !== route) {
        router.push(route);
      }
    },
    [pathname, router],
  );

  const startTutorial = useCallback(
    async (
      options: StartTutorialOptions,
    ): Promise<boolean> => {
      const definition =
        getTutorialDefinition(
          options.tutorialKey,
        );

      if (!definition) {
        setErrorMessage(
          `Le didacticiel « ${options.tutorialKey} » est introuvable.`,
        );

        return false;
      }

      setIsPending(true);
      setErrorMessage(null);

      try {
        const result =
          await startTutorialAction({
            tutorialKey:
              options.tutorialKey,
            launchSource:
              options.launchSource,
            restartFromBeginning:
              options.restartFromBeginning ??
              false,
          });

        if (!result.ok) {
          setErrorMessage(result.error);
          return false;
        }

        const session = result.session;

        if (!session) {
          setErrorMessage(
            "La session du didacticiel n’a pas pu être créée.",
          );

          return false;
        }

        const stepIndex = findStepIndex(
          { definition },
          result.currentStepKey,
        );

        const step =
          definition.steps[stepIndex];

        if (!step) {
          setErrorMessage(
            "Aucune étape valide n’est disponible pour ce didacticiel.",
          );

          return false;
        }

        saveProgress(result.progress);

        setInstantAutoStartTutorialKey(
          (currentKey) =>
            currentKey === definition.key
              ? null
              : currentKey,
        );

        if (
          definition.displayMode ===
          "embedded"
        ) {
          setActiveTutorial(null);
          navigateToStep(step.route);
          return true;
        }

        setActiveTutorial({
          definition,
          progress: result.progress,
          session,
          currentStepIndex: stepIndex,
        });

        navigateToStep(step.route);

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
      navigateToStep,
      saveProgress,
    ],
  );

  const updateCurrentStep = useCallback(
    async (
      nextStepIndex: number,
    ): Promise<boolean> => {
      if (!activeTutorial) {
        return false;
      }

      const step =
        activeTutorial.definition.steps[
          nextStepIndex
        ];

      if (!step) {
        return false;
      }

      setIsPending(true);
      setErrorMessage(null);

      try {
        const result =
          await setTutorialStepAction({
            tutorialKey:
              activeTutorial.definition.key,
            stepKey: step.key,
            route: step.route,
          });

        if (!result.ok) {
          setErrorMessage(result.error);
          return false;
        }

        const updatedSession =
          result.session;

        if (!updatedSession) {
          setErrorMessage(
            "La session active du didacticiel est introuvable.",
          );

          return false;
        }

        saveProgress(result.progress);

        setActiveTutorial((current) => {
          if (!current) {
            return null;
          }

          return {
            ...current,
            progress: result.progress,
            session: updatedSession,
            currentStepIndex:
              nextStepIndex,
          };
        });

        navigateToStep(step.route);

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
    [
      activeTutorial,
      navigateToStep,
      saveProgress,
    ],
  );

  const previousStep =
    useCallback(async () => {
      if (!activeTutorial) {
        return;
      }

      const previousIndex =
        activeTutorial.currentStepIndex - 1;

      if (previousIndex < 0) {
        return;
      }

      await updateCurrentStep(
        previousIndex,
      );
    }, [
      activeTutorial,
      updateCurrentStep,
    ]);

  const completeTutorial =
    useCallback(async () => {
      if (!activeTutorial) {
        return;
      }

      const currentStep =
        activeTutorial.definition.steps[
          activeTutorial.currentStepIndex
        ];

      if (!currentStep) {
        return;
      }

      setIsPending(true);
      setErrorMessage(null);

      try {
        const result =
          await completeTutorialAction({
            tutorialKey:
              activeTutorial.definition.key,
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
            : "Impossible de terminer le didacticiel.",
        );
      } finally {
        setIsPending(false);
      }
    }, [
      activeTutorial,
      saveProgress,
    ]);

  const nextStep =
    useCallback(async () => {
      if (!activeTutorial) {
        return;
      }

      const nextIndex =
        activeTutorial.currentStepIndex + 1;

      if (
        nextIndex >=
        activeTutorial.definition.steps
          .length
      ) {
        await completeTutorial();
        return;
      }

      await updateCurrentStep(nextIndex);
    }, [
      activeTutorial,
      completeTutorial,
      updateCurrentStep,
    ]);

  const quitTutorial =
    useCallback(async () => {
      if (!activeTutorial) {
        return;
      }

      const currentStep =
        activeTutorial.definition.steps[
          activeTutorial.currentStepIndex
        ];

      if (!currentStep) {
        return;
      }

      setIsPending(true);
      setErrorMessage(null);

      try {
        const result =
          await quitTutorialAction({
            tutorialKey:
              activeTutorial.definition.key,
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
    }, [
      activeTutorial,
      saveProgress,
    ]);

  const skipTutorial =
    useCallback(async () => {
      if (!activeTutorial) {
        return;
      }

      const confirmed =
        window.confirm(
          "Passer le didacticiel ?\n\nIl ne sera plus proposé automatiquement, mais restera disponible depuis le Guide.",
        );

      if (!confirmed) {
        return;
      }

      setIsPending(true);
      setErrorMessage(null);

      try {
        const result =
          await skipTutorialAction({
            tutorialKey:
              activeTutorial.definition.key,
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
    }, [
      activeTutorial,
      saveProgress,
    ]);

  const getTutorialProgress =
    useCallback(
      (
        tutorialKey: string,
      ): TutorialProgressRow | null =>
        progressByTutorialKey[
          tutorialKey
        ] ?? null,
      [progressByTutorialKey],
    );

  const clearTutorialError =
    useCallback(() => {
      setErrorMessage(null);
    }, []);

  const startInstantAutoStartTutorial =
    useCallback(() => {
      if (!instantAutoStartTutorialKey) {
        return;
      }

      const progress =
        progressByTutorialKey[
          instantAutoStartTutorialKey
        ];

      const launchSource: TutorialSessionLaunchSource =
        progress?.status === "in_progress"
          ? "resume"
          : "automatic";

      autoStartAttemptedRef.current = true;

      void startTutorial({
        tutorialKey:
          instantAutoStartTutorialKey,
        launchSource,
        restartFromBeginning: false,
      });
    }, [
      instantAutoStartTutorialKey,
      progressByTutorialKey,
      startTutorial,
    ]);

  const skipInstantAutoStartTutorial =
    useCallback(async () => {
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
        const result =
          await skipTutorialAction({
            tutorialKey:
              instantAutoStartTutorialKey,
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
    }, [
      instantAutoStartTutorialKey,
      saveProgress,
    ]);

  useEffect(() => {
    if (
      autoStartAttemptedRef.current ||
      activeTutorial ||
      isPending
    ) {
      return;
    }

    const timeoutId =
      window.setTimeout(() => {
        autoStartAttemptedRef.current =
          true;

        const definition =
          listAutoStartTutorialDefinitions()
            .filter((candidate) =>
              autoStartTutorialKeySet.has(
                candidate.key,
              ),
            )
            .find((candidate) => {
              const progress =
                progressByTutorialKey[
                  candidate.key
                ];

              return (
                !progress ||
                progress.status ===
                  "not_started" ||
                progress.status ===
                  "in_progress"
              );
            });

        if (!definition) {
          return;
        }

        const progress =
          progressByTutorialKey[
            definition.key
          ];

        const launchSource: TutorialSessionLaunchSource =
          progress?.status ===
          "in_progress"
            ? "resume"
            : "automatic";

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
    isPending,
    progressByTutorialKey,
    startTutorial,
  ]);

  const contextValue =
    useMemo<TutorialContextValue>(
      () => ({
        activeTutorial,
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
        synchronizeTutorialProgress:
          saveProgress,
      }),
      [
        activeTutorial,
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
        saveProgress,
      ],
    );

  const instantAutoStartDefinition =
    instantAutoStartTutorialKey
      ? getTutorialDefinition(
          instantAutoStartTutorialKey,
        )
      : null;

  const instantAutoStartStep =
    instantAutoStartDefinition?.steps[0] ??
    null;

  const shouldDisplayInstantIntro =
    !activeTutorial &&
    Boolean(instantAutoStartDefinition) &&
    Boolean(instantAutoStartStep) &&
    instantAutoStartStep?.route === pathname;

  const currentStep =
    activeTutorial?.definition.steps[
      activeTutorial.currentStepIndex
    ] ?? null;

  const shouldDisplayOverlay =
    Boolean(activeTutorial) &&
    Boolean(currentStep) &&
    currentStep?.route === pathname;

  return (
    <TutorialContext.Provider
      value={contextValue}
    >
      {instantAutoStartDefinition &&
      instantAutoStartStep &&
      shouldDisplayInstantIntro ? (
        <TutorialInstantIntro
          tutorialTitle={
            instantAutoStartDefinition.title
          }
          step={instantAutoStartStep}
          isPending={isPending}
          errorMessage={errorMessage}
          onStart={
            startInstantAutoStartTutorial
          }
          onSkip={() => {
            void skipInstantAutoStartTutorial();
          }}
        />
      ) : null}

      {children}

      {activeTutorial &&
      currentStep &&
      shouldDisplayOverlay ? (
        <TutorialOverlay
          tutorialTitle={
            activeTutorial.definition.title
          }
          step={currentStep}
          stepIndex={
            activeTutorial.currentStepIndex
          }
          totalSteps={
            activeTutorial.definition.steps
              .length
          }
          canGoPrevious={
            activeTutorial.currentStepIndex >
            0
          }
          isLastStep={
            activeTutorial.currentStepIndex ===
            activeTutorial.definition.steps
              .length -
              1
          }
          isPending={isPending}
          errorMessage={errorMessage}
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
        />
      ) : null}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const context =
    useContext(TutorialContext);

  if (!context) {
    throw new Error(
      "useTutorial doit être utilisé à l’intérieur de TutorialProvider.",
    );
  }

  return context;
}