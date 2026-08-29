"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { useLocale } from "@/components/i18n/locale-provider";
import {
  calculateTutorialPanelPosition,
  expandTutorialTargetRectangle,
  fitTutorialTargetRectangleToVisibleArea,
  type TutorialPanelPosition,
  type TutorialViewportSize,
} from "@/lib/tutorial/geometry";
import type { TutorialStep, TutorialTargetRectangle } from "@/types/tutorial";

type TutorialOverlayProps = {
  tutorialTitle: string;
  presentation?: "focused" | "informative";
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;

  canGoPrevious: boolean;
  isLastStep: boolean;

  isPending?: boolean;
  errorMessage?: string | null;
  followUpLabel?: string;

  onPrevious: () => void;
  onNext: () => void;
  onQuit: () => void;
  onSkip: () => void;
  onFollowUp?: () => void;
};

const DEFAULT_PANEL_WIDTH = 420;
const DEFAULT_PANEL_HEIGHT = 300;

const MOBILE_BREAKPOINT = 640;

function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.innerWidth < MOBILE_BREAKPOINT
  );
}

const emptySubscribe = () => () => undefined;

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function rectangleFromDomRect(rectangle: DOMRect): TutorialTargetRectangle {
  return {
    top: rectangle.top,
    right: rectangle.right,
    bottom: rectangle.bottom,
    left: rectangle.left,
    width: rectangle.width,
    height: rectangle.height,
  };
}

function targetNeedsRecentering(
  rectangle: DOMRect,
  reservedBottom = 32,
): boolean {
  const safeMargin = 32;

  return (
    rectangle.top < safeMargin ||
    rectangle.left < safeMargin ||
    rectangle.bottom > window.innerHeight - reservedBottom ||
    rectangle.right > window.innerWidth - safeMargin
  );
}

export function TutorialOverlay({
  tutorialTitle,
  presentation = "focused",
  step,
  stepIndex,
  totalSteps,
  canGoPrevious,
  isLastStep,
  isPending = false,
  errorMessage = null,
  followUpLabel,
  onPrevious,
  onNext,
  onQuit,
  onSkip,
  onFollowUp,
}: TutorialOverlayProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const isClient = useIsClient();
  const isInformative = presentation === "informative";

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  const [targetRectangle, setTargetRectangle] =
    useState<TutorialTargetRectangle | null>(null);

  const [targetCompletionState, setTargetCompletionState] = useState({
    stepKey: step.key,
    ready: !step.requiresTargetCompletion,
  });

  const [isMobile, setIsMobile] = useState(isMobileViewport);

  const [viewportSize, setViewportSize] = useState<TutorialViewportSize>({
    width: 0,
    height: 0,
  });

  const [panelPosition, setPanelPosition] = useState<TutorialPanelPosition>({
    placement: "center",
    left: 12,
    top: 12,
  });

  const [isSuspendedByDialog, setIsSuspendedByDialog] = useState(false);

  useEffect(() => {
    if (!isClient) return;

    if (!isInformative) {
      previousFocusedElementRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      panelRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onQuit();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (!isInformative) {
        previousFocusedElementRef.current?.focus();
      }
    };
  }, [isClient, isInformative, onQuit, step.key]);

  useEffect(() => {
    if (!isClient || !isInformative) {
      return;
    }

    let synchronizationFrame = 0;

    function synchronizeNestedDialog() {
      const focusedElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const activeDialog = focusedElement?.closest<HTMLElement>(
        '[role="dialog"]',
      );

      setIsSuspendedByDialog(Boolean(activeDialog));
    }

    document.addEventListener("focusin", synchronizeNestedDialog);
    synchronizationFrame = window.requestAnimationFrame(
      synchronizeNestedDialog,
    );

    return () => {
      window.cancelAnimationFrame(synchronizationFrame);
      document.removeEventListener("focusin", synchronizeNestedDialog);
    };
  }, [isClient, isInformative]);

  useLayoutEffect(() => {
    if (!isClient) return;

    let firstAnimationFrame = 0;
    let secondAnimationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let targetDiscoveryObserver: MutationObserver | null = null;
    let targetCompletionObserver: MutationObserver | null = null;

    function findTargetElement(): HTMLElement | null {
      const targetId =
        isMobileViewport() && step.mobileTargetId
          ? step.mobileTargetId
          : step.targetId;

      if (!targetId) return null;

      const preferredTarget = document.querySelector<HTMLElement>(
        `[data-tutorial-id="${targetId}"]`,
      );

      if (preferredTarget || targetId === step.targetId || !step.targetId) {
        return preferredTarget;
      }

      return document.querySelector<HTMLElement>(
        `[data-tutorial-id="${step.targetId}"]`,
      );
    }

    function updateGeometry() {
      const nextViewportSize = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      setViewportSize(nextViewportSize);

      setIsMobile(nextViewportSize.width < MOBILE_BREAKPOINT);

      const panel = panelRef.current;

      const panelSize = {
        width:
          panel?.offsetWidth ??
          Math.min(
            DEFAULT_PANEL_WIDTH,
            Math.max(0, nextViewportSize.width - 24),
          ),
        height: panel?.offsetHeight ?? DEFAULT_PANEL_HEIGHT,
      };

      const targetElement = findTargetElement();
      const nextTargetCompletionReady =
        !step.requiresTargetCompletion ||
        targetElement?.dataset.tutorialComplete === "true";
      setTargetCompletionState((current) =>
        current.stepKey === step.key &&
        current.ready === nextTargetCompletionReady
          ? current
          : {
              stepKey: step.key,
              ready: nextTargetCompletionReady,
            },
      );
      const rawTargetRectangle = targetElement?.getBoundingClientRect() ?? null;
      const expandedTargetRectangle = rawTargetRectangle
        ? expandTutorialTargetRectangle(
            rectangleFromDomRect(rawTargetRectangle),
            step.highlightPadding ?? 8,
            nextViewportSize,
          )
        : null;
      const mobileViewport = nextViewportSize.width < MOBILE_BREAKPOINT;
      const nextTargetRectangle =
        expandedTargetRectangle && mobileViewport
          ? fitTutorialTargetRectangleToVisibleArea(
              expandedTargetRectangle,
              nextViewportSize,
              {
                visibleTop: 10,
                visibleBottom: Math.max(
                  10,
                  nextViewportSize.height - panelSize.height - 10,
                ),
              },
            )
          : expandedTargetRectangle;

      setTargetRectangle(nextTargetRectangle);

      setPanelPosition(
        calculateTutorialPanelPosition({
          targetRectangle: nextTargetRectangle,
          preferredPlacement: step.placement ?? "bottom",
          panelSize,
          viewportSize: nextViewportSize,
        }),
      );
    }

    function observeTargetElement(targetElement: HTMLElement) {
      resizeObserver?.observe(targetElement);

      if (
        step.requiresTargetCompletion &&
        typeof MutationObserver !== "undefined"
      ) {
        targetCompletionObserver?.disconnect();
        targetCompletionObserver = new MutationObserver(updateGeometry);
        targetCompletionObserver.observe(targetElement, {
          attributes: true,
          attributeFilter: ["data-tutorial-complete"],
        });
      }
    }

    function recenterTargetElement(targetElement: HTMLElement) {
      const rectangle = targetElement.getBoundingClientRect();
      const mobileViewport = isMobileViewport();
      const reservedBottom = mobileViewport
        ? (panelRef.current?.offsetHeight ??
            Math.round(window.innerHeight * 0.3)) + 12
        : 32;

      if (!targetNeedsRecentering(rectangle, reservedBottom)) {
        return;
      }

      if (mobileViewport) {
        const visibleHeight = Math.max(
          80,
          window.innerHeight - reservedBottom - 20,
        );
        const desiredTop =
          rectangle.height > visibleHeight
            ? 10
            : Math.max(10, 10 + (visibleHeight - rectangle.height) / 2);

        window.scrollBy({
          top: rectangle.top - desiredTop,
          behavior: "auto",
        });
      } else {
        targetElement.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "auto",
        });
      }
    }

    const targetElement = findTargetElement();

    if (targetElement) {
      recenterTargetElement(targetElement);
    }

    firstAnimationFrame = window.requestAnimationFrame(() => {
      secondAnimationFrame = window.requestAnimationFrame(updateGeometry);
    });

    window.addEventListener("resize", updateGeometry);

    window.addEventListener("scroll", updateGeometry, true);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateGeometry);

      if (targetElement) {
        observeTargetElement(targetElement);
      }

      if (panelRef.current) {
        resizeObserver.observe(panelRef.current);
      }
    }

    if (targetElement && typeof ResizeObserver === "undefined") {
      observeTargetElement(targetElement);
    } else if (
      !targetElement &&
      typeof MutationObserver !== "undefined"
    ) {
      targetDiscoveryObserver = new MutationObserver(() => {
        const discoveredTarget = findTargetElement();

        if (!discoveredTarget) {
          return;
        }

        targetDiscoveryObserver?.disconnect();
        targetDiscoveryObserver = null;
        observeTargetElement(discoveredTarget);
        recenterTargetElement(discoveredTarget);
        updateGeometry();
      });
      targetDiscoveryObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.cancelAnimationFrame(firstAnimationFrame);

      window.cancelAnimationFrame(secondAnimationFrame);

      window.removeEventListener("resize", updateGeometry);

      window.removeEventListener("scroll", updateGeometry, true);

      resizeObserver?.disconnect();
      targetDiscoveryObserver?.disconnect();
      targetCompletionObserver?.disconnect();
    };
  }, [
    isClient,
    step.highlightPadding,
    step.key,
    step.mobileTargetId,
    step.placement,
    step.requiresTargetCompletion,
    step.targetId,
  ]);

  if (!isClient) {
    return null;
  }

  const highlightedArea = targetRectangle;

  const panelLabelId = `tutorial-step-${step.key}-title`;

  const panelDescriptionId = `tutorial-step-${step.key}-description`;

  const progressionPercentage =
    totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;
  const canContinue =
    !step.requiresTargetCompletion ||
    (targetCompletionState.stepKey === step.key &&
      targetCompletionState.ready);
  const shouldSuspendOverlay = isInformative && isSuspendedByDialog;
  const shouldDockInformativePanel =
    isInformative && !step.allowTargetInteraction;
  const dimLayerPointerEvents =
    isInformative || (isMobile && step.allowTargetInteraction)
      ? "pointer-events-none"
      : "pointer-events-auto";

  return createPortal(
    <div
      aria-hidden={shouldSuspendOverlay ? true : undefined}
      className={`pointer-events-none fixed inset-0 z-[220] ${
        shouldSuspendOverlay ? "invisible" : ""
      }`}
      data-tutorial-overlay="true"
      data-tutorial-suspended={shouldSuspendOverlay ? "true" : "false"}
    >
      {highlightedArea ? (
        <>
          {isInformative ? null : (
            <>
              <div
                aria-hidden="true"
                className={`${dimLayerPointerEvents} fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none`}
                style={{
                  left: 0,
                  top: 0,
                  width: viewportSize.width,
                  height: highlightedArea.top,
                }}
              />

              <div
                aria-hidden="true"
                className={`${dimLayerPointerEvents} fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none`}
                style={{
                  left: 0,
                  top: highlightedArea.top,
                  width: highlightedArea.left,
                  height: highlightedArea.height,
                }}
              />

              <div
                aria-hidden="true"
                className={`${dimLayerPointerEvents} fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none`}
                style={{
                  left: highlightedArea.right,
                  top: highlightedArea.top,
                  width: Math.max(0, viewportSize.width - highlightedArea.right),
                  height: highlightedArea.height,
                }}
              />

              <div
                aria-hidden="true"
                className={`${dimLayerPointerEvents} fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none`}
                style={{
                  left: 0,
                  top: highlightedArea.bottom,
                  width: viewportSize.width,
                  height: Math.max(0, viewportSize.height - highlightedArea.bottom),
                }}
              />
            </>
          )}

          <div
            aria-hidden="true"
            className={
              isInformative
                ? "pointer-events-none fixed rounded-2xl border-2 border-[#42B99A] bg-[#DFF4EC]/10 shadow-[0_0_0_5px_rgba(66,185,154,0.14),0_10px_30px_rgba(23,105,81,0.14)] transition-[left,top,width,height] duration-150"
                : "fixed rounded-2xl border-2 border-[#F2C94C] shadow-[0_0_0_4px_rgba(242,201,76,0.22),0_12px_40px_rgba(0,0,0,0.28)] transition-[left,top,width,height] duration-150"
            }
            style={{
              left: highlightedArea.left,
              top: highlightedArea.top,
              width: highlightedArea.width,
              height: highlightedArea.height,
              pointerEvents:
                isInformative || step.allowTargetInteraction ? "none" : "auto",
            }}
          />

          {isInformative ? (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[225] rounded-full border border-[#42B99A]/35 bg-[#F3FBF7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#176951] shadow-[0_6px_18px_rgba(23,105,81,0.16)]"
              style={{
                left: Math.max(12, highlightedArea.left),
                top: Math.max(8, highlightedArea.top - 30),
              }}
            >
              {isEnglish ? "Suggested landmark" : "Repère conseillé"}
            </div>
          ) : null}
        </>
      ) : (
        isInformative ? null : (
          <div
            aria-hidden="true"
            className="pointer-events-auto fixed inset-0 bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none"
          />
        )
      )}

      <div
        ref={panelRef}
        role={isInformative ? "region" : "dialog"}
        aria-modal={
          isInformative
            ? undefined
            : step.allowTargetInteraction
              ? undefined
              : true
        }
        aria-labelledby={panelLabelId}
        aria-describedby={panelDescriptionId}
        tabIndex={-1}
        data-tutorial-panel-layout={
          isMobile
            ? "mobile-sheet"
            : shouldDockInformativePanel
              ? "informative-dock"
              : panelPosition.placement
        }
        data-tutorial-presentation={presentation}
        className={
          isMobile
            ? `pointer-events-auto fixed inset-x-0 bottom-0 z-[230] flex max-h-[30dvh] flex-col overflow-hidden rounded-t-[1.25rem] border-t border-[#315B3E]/15 bg-[#FFFDF4] pb-[env(safe-area-inset-bottom)] text-[#16342D] outline-none ${isInformative ? "shadow-[0_-10px_34px_rgba(23,105,81,0.2)]" : "shadow-[0_-16px_50px_rgba(7,26,23,0.4)]"}`
            : `pointer-events-auto fixed z-[230] flex max-h-[min(72dvh,560px)] flex-col overflow-hidden rounded-[1.5rem] border bg-[#FFFDF4] text-[#16342D] outline-none ${isInformative ? "w-[min(390px,calc(100vw-24px))] border-[#42B99A]/30 shadow-[0_18px_55px_rgba(23,105,81,0.2)]" : "w-[min(420px,calc(100vw-24px))] border-[#315B3E]/15 shadow-[0_28px_90px_rgba(7,26,23,0.42)]"}`
        }
        style={
          isMobile
            ? undefined
            : shouldDockInformativePanel
              ? {
                  right: 12,
                  bottom: 12,
                }
              : {
                  left: panelPosition.left,
                  top: panelPosition.top,
                }
        }
      >
        <div
          className={
            isMobile
              ? "shrink-0 border-b border-[#315B3E]/10 bg-[#E9F5F0] px-4 py-2.5"
              : "border-b border-[#315B3E]/10 bg-[#E9F5F0] px-5 py-4"
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {isMobile ? (
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
                  {isEnglish ? "Step" : "Étape"} {stepIndex + 1}/{totalSteps}
                </p>
              ) : (
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                  {tutorialTitle}
                </p>
              )}

              <h2
                id={panelLabelId}
                className={
                  isMobile
                    ? "text-base font-black leading-tight text-[#0B302B]"
                    : "mt-1 text-lg font-black leading-tight text-[#0B302B]"
                }
              >
                {step.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onQuit}
              disabled={isPending}
              aria-label={
                isEnglish
                  ? "Leave the tutorial and resume later"
                  : "Quitter le didacticiel et reprendre plus tard"
              }
              className={
                isMobile
                  ? "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#315B3E]/15 bg-white text-base font-black text-[#48665F] transition hover:border-[#278B70]/40 hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-wait disabled:opacity-50"
                  : "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#315B3E]/15 bg-white text-lg font-black text-[#48665F] transition hover:border-[#278B70]/40 hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-wait disabled:opacity-50"
              }
            >
              ×
            </button>
          </div>

          <div
            className={
              isMobile
                ? "mt-1.5 h-1 overflow-hidden rounded-full bg-white"
                : "mt-3 h-1.5 overflow-hidden rounded-full bg-white"
            }
          >
            <div
              className="h-full rounded-full bg-[#278B70] transition-[width] duration-200"
              style={{
                width: `${progressionPercentage}%`,
              }}
            />
          </div>

          {isMobile ? null : (
            <p className="mt-2 text-[10px] font-bold text-[#668078]">
              {isEnglish ? "Step" : "Étape"} {stepIndex + 1}{" "}
              {isEnglish ? "of" : "sur"} {totalSteps}
            </p>
          )}
        </div>

        <div
          id={panelDescriptionId}
          aria-live="polite"
          className={
            isMobile
              ? "min-h-0 flex-1 overflow-y-auto px-4 py-2"
              : "min-h-0 flex-1 overflow-y-auto px-5 py-5"
          }
        >
          <p
            className={
              isMobile
                ? "whitespace-pre-line text-[13px] font-semibold leading-5 text-[#35554D]"
                : "whitespace-pre-line text-sm font-semibold leading-6 text-[#35554D]"
            }
          >
            {step.content}
          </p>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-[#B94A48]/20 bg-[#FDEDEC] px-3 py-2 text-xs font-bold leading-5 text-[#8B302E]"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div
          className={
            isMobile
              ? "shrink-0 border-t border-[#315B3E]/10 bg-white px-4 py-2"
              : "border-t border-[#315B3E]/10 bg-white px-5 py-4"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              disabled={isPending}
              className="text-xs font-bold text-[#6B7F79] underline decoration-[#6B7F79]/35 underline-offset-4 transition hover:text-[#8B302E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-wait disabled:opacity-50"
            >
              {isEnglish ? "Skip tutorial" : "Passer le didacticiel"}
            </button>

            <div className="ml-auto flex items-center gap-2">
              {isLastStep && followUpLabel && onFollowUp ? (
                <button
                  type="button"
                  aria-label={followUpLabel}
                  onClick={onFollowUp}
                  disabled={isPending}
                  className={
                    isMobile
                      ? "min-h-10 rounded-xl border border-[#F2C94C]/55 bg-[#FDF4D6] px-3 text-xs font-black text-[#755913] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-wait disabled:opacity-60"
                      : "min-h-10 rounded-xl border border-[#F2C94C]/55 bg-[#FDF4D6] px-5 text-xs font-black text-[#755913] transition hover:border-[#F2C94C] hover:text-[#986C00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                  }
                >
                  {isMobile
                    ? isEnglish
                      ? "Next tutorial"
                      : "Parcours suivant"
                    : followUpLabel}
                </button>
              ) : null}

              <button
                type="button"
                onClick={onPrevious}
                disabled={!canGoPrevious || isPending}
                className="min-h-10 rounded-xl border border-[#315B3E]/15 bg-white px-4 text-xs font-black text-[#35554D] transition hover:border-[#278B70]/40 hover:bg-[#F2F8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isEnglish ? "Previous" : "Précédent"}
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={isPending || !canContinue}
                data-tutorial-next-ready={canContinue ? "true" : "false"}
                className="min-h-10 rounded-xl bg-[#176951] px-5 text-xs font-black text-white shadow-md transition hover:bg-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? isEnglish
                    ? "Saving…"
                    : "Enregistrement…"
                  : !canContinue
                    ? isEnglish
                      ? "Complete this action"
                      : "Action à compléter"
                    : isLastStep
                    ? isEnglish
                      ? "Finish"
                      : "Terminer"
                    : isEnglish
                      ? "Next"
                      : "Suivant"}
              </button>
            </div>
          </div>

          {isMobile ? null : (
            <p className="mt-3 text-[10px] font-semibold leading-4 text-[#82928D]">
              {isEnglish
                ? "Leaving saves your progress. Skipping permanently hides the automatic launch, but the tutorial remains available in the Guide."
                : "Quitter conserve votre progression. Passer masque définitivement le lancement automatique, mais le parcours restera disponible dans le Guide."}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
