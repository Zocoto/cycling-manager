"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import {
  calculateTutorialPanelPosition,
  expandTutorialTargetRectangle,
  type TutorialPanelPosition,
  type TutorialViewportSize,
} from "@/lib/tutorial/geometry";
import type { TutorialStep, TutorialTargetRectangle } from "@/types/tutorial";

type TutorialOverlayProps = {
  tutorialTitle: string;
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
  const isClient = useIsClient();

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  const [targetRectangle, setTargetRectangle] =
    useState<TutorialTargetRectangle | null>(null);

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

  useEffect(() => {
    if (!isClient) return;

    previousFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onQuit();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      previousFocusedElementRef.current?.focus();
    };
  }, [isClient, onQuit, step.key]);

  useLayoutEffect(() => {
    if (!isClient) return;

    let firstAnimationFrame = 0;
    let secondAnimationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    function findTargetElement(): HTMLElement | null {
      if (!step.targetId) return null;

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

      const targetElement = findTargetElement();
      const rawTargetRectangle = targetElement?.getBoundingClientRect() ?? null;

      const nextTargetRectangle = rawTargetRectangle
        ? expandTutorialTargetRectangle(
            rectangleFromDomRect(rawTargetRectangle),
            step.highlightPadding ?? 8,
            nextViewportSize,
          )
        : null;

      setTargetRectangle(nextTargetRectangle);

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

      setPanelPosition(
        calculateTutorialPanelPosition({
          targetRectangle: nextTargetRectangle,
          preferredPlacement: step.placement ?? "bottom",
          panelSize,
          viewportSize: nextViewportSize,
        }),
      );
    }

    const targetElement = findTargetElement();

    if (targetElement) {
      const rectangle = targetElement.getBoundingClientRect();
      const mobileViewport = isMobileViewport();
      const reservedBottom = mobileViewport
        ? (panelRef.current?.offsetHeight ??
            Math.round(window.innerHeight * 0.36)) + 16
        : 32;

      if (targetNeedsRecentering(rectangle, reservedBottom)) {
        targetElement.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "auto",
        });

        if (mobileViewport) {
          window.scrollBy(0, reservedBottom / 2);
        }
      }
    }

    firstAnimationFrame = window.requestAnimationFrame(() => {
      secondAnimationFrame = window.requestAnimationFrame(updateGeometry);
    });

    window.addEventListener("resize", updateGeometry);

    window.addEventListener("scroll", updateGeometry, true);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateGeometry);

      if (targetElement) {
        resizeObserver.observe(targetElement);
      }

      if (panelRef.current) {
        resizeObserver.observe(panelRef.current);
      }
    }

    return () => {
      window.cancelAnimationFrame(firstAnimationFrame);

      window.cancelAnimationFrame(secondAnimationFrame);

      window.removeEventListener("resize", updateGeometry);

      window.removeEventListener("scroll", updateGeometry, true);

      resizeObserver?.disconnect();
    };
  }, [
    isClient,
    step.highlightPadding,
    step.key,
    step.placement,
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

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[220]"
      data-tutorial-overlay="true"
    >
      {highlightedArea ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-auto fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none"
            style={{
              left: 0,
              top: 0,
              width: viewportSize.width,
              height: highlightedArea.top,
            }}
          />

          <div
            aria-hidden="true"
            className="pointer-events-auto fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none"
            style={{
              left: 0,
              top: highlightedArea.top,
              width: highlightedArea.left,
              height: highlightedArea.height,
            }}
          />

          <div
            aria-hidden="true"
            className="pointer-events-auto fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none"
            style={{
              left: highlightedArea.right,
              top: highlightedArea.top,
              width: Math.max(0, viewportSize.width - highlightedArea.right),
              height: highlightedArea.height,
            }}
          />

          <div
            aria-hidden="true"
            className="pointer-events-auto fixed bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none"
            style={{
              left: 0,
              top: highlightedArea.bottom,
              width: viewportSize.width,
              height: Math.max(0, viewportSize.height - highlightedArea.bottom),
            }}
          />

          <div
            aria-hidden="true"
            className="fixed rounded-2xl border-2 border-[#F2C94C] shadow-[0_0_0_4px_rgba(242,201,76,0.22),0_12px_40px_rgba(0,0,0,0.28)] transition-[left,top,width,height] duration-150"
            style={{
              left: highlightedArea.left,
              top: highlightedArea.top,
              width: highlightedArea.width,
              height: highlightedArea.height,
              pointerEvents: step.allowTargetInteraction ? "none" : "auto",
            }}
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-auto fixed inset-0 bg-[#071A17]/78 backdrop-blur-[1px] max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none"
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={step.allowTargetInteraction ? undefined : true}
        aria-labelledby={panelLabelId}
        aria-describedby={panelDescriptionId}
        tabIndex={-1}
        data-tutorial-panel-layout={
          isMobile ? "mobile-sheet" : panelPosition.placement
        }
        className={
          isMobile
            ? "pointer-events-auto fixed inset-x-0 bottom-0 z-[230] flex max-h-[36dvh] flex-col overflow-hidden rounded-t-[1.25rem] border-t border-[#315B3E]/15 bg-[#FFFDF4] pb-[env(safe-area-inset-bottom)] text-[#16342D] shadow-[0_-16px_50px_rgba(7,26,23,0.4)] outline-none"
            : "pointer-events-auto fixed z-[230] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-[1.5rem] border border-[#315B3E]/15 bg-[#FFFDF4] text-[#16342D] shadow-[0_28px_90px_rgba(7,26,23,0.42)] outline-none"
        }
        style={
          isMobile
            ? undefined
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
                  Étape {stepIndex + 1}/{totalSteps}
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
              aria-label="Quitter le didacticiel et reprendre plus tard"
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
              Étape {stepIndex + 1} sur {totalSteps}
            </p>
          )}
        </div>

        <div
          id={panelDescriptionId}
          aria-live="polite"
          className={
            isMobile
              ? "min-h-0 flex-1 overflow-y-auto px-4 py-3"
              : "px-5 py-5"
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
              ? "shrink-0 border-t border-[#315B3E]/10 bg-white px-4 py-2.5"
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
              Passer le didacticiel
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
                  {isMobile ? "Parcours suivant" : followUpLabel}
                </button>
              ) : null}

              <button
                type="button"
                onClick={onPrevious}
                disabled={!canGoPrevious || isPending}
                className="min-h-10 rounded-xl border border-[#315B3E]/15 bg-white px-4 text-xs font-black text-[#35554D] transition hover:border-[#278B70]/40 hover:bg-[#F2F8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Précédent
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={isPending}
                className="min-h-10 rounded-xl bg-[#176951] px-5 text-xs font-black text-white shadow-md transition hover:bg-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                {isPending
                  ? "Enregistrement…"
                  : isLastStep
                    ? "Terminer"
                    : "Suivant"}
              </button>
            </div>
          </div>

          {isMobile ? null : (
            <p className="mt-3 text-[10px] font-semibold leading-4 text-[#82928D]">
              Quitter conserve votre progression. Passer masque définitivement le
              lancement automatique, mais le parcours restera disponible dans le
              Guide.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
