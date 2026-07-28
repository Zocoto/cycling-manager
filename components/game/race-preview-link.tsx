"use client";

import NextLink, { type LinkProps } from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RACE_PROFILE_LABELS } from "@/lib/game/race-calendar";
import {
  summarizeCobbles,
  type RaceQuickPreview,
  type RaceQuickPreviewStage,
  type RaceQuickPreviewTarget,
} from "@/lib/game/race-quick-preview";

type RacePreviewLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    previewTarget: RaceQuickPreviewTarget;
    children?: ReactNode;
  };

type PreviewPosition = {
  left: number;
  top: number;
  width: number;
};

type PreviewRequest = {
  expiresAt: number;
  request: Promise<RaceQuickPreview>;
};

const previewRequests = new Map<string, PreviewRequest>();

export const RacePreviewLink = forwardRef<
  HTMLAnchorElement,
  RacePreviewLinkProps
>(function RacePreviewLink(
  {
    previewTarget,
    children,
    href,
    onBlur,
    onClick,
    onFocus,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    ...props
  },
  forwardedRef,
) {
  const panelId = useId();
  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const lastPointerTypeRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(false);
  const [preview, setPreview] = useState<RaceQuickPreview | null>(
    null,
  );
  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [position, setPosition] = useState<PreviewPosition>({
    left: 12,
    top: 12,
    width: 480,
  });

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const viewportPadding = 12;
      const isMobile =
        window.innerWidth < 640 ||
        window.matchMedia("(hover: none), (pointer: coarse)").matches;
      const width = Math.min(
        480,
        window.innerWidth - viewportPadding * 2,
      );
      const panelHeight = panelRef.current?.offsetHeight ?? 520;
      const rect = trigger.getBoundingClientRect();
      const left = isMobile
        ? viewportPadding
        : Math.min(
            window.innerWidth - width - viewportPadding,
            Math.max(
              viewportPadding,
              rect.left + rect.width / 2 - width / 2,
            ),
          );
      const top = isMobile
        ? Math.max(
            viewportPadding,
            window.innerHeight - panelHeight - viewportPadding,
          )
        : rect.bottom + 10 + panelHeight <=
            window.innerHeight - viewportPadding
          ? rect.bottom + 10
          : Math.max(viewportPadding, rect.top - panelHeight - 10);

      setMobileLayout(isMobile);
      setPosition({ left, top, width });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, loadState, preview, previewTarget.stageNumber]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideInteraction(event: globalThis.PointerEvent) {
      const eventTarget = event.target as Node;
      if (
        !triggerRef.current?.contains(eventTarget) &&
        !panelRef.current?.contains(eventTarget)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsideInteraction,
      );
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(
    () => () => {
      cancelTimer(openTimerRef);
      cancelTimer(closeTimerRef);
    },
    [],
  );

  function setTriggerRef(node: HTMLAnchorElement | null) {
    triggerRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }

  function loadPreview() {
    if (loadState === "loading" || loadState === "loaded") return;

    setLoadState("loading");
    getPreview(previewTarget.slug)
      .then((loadedPreview) => {
        setPreview(loadedPreview);
        setLoadState("loaded");
      })
      .catch(() => {
        previewRequests.delete(previewTarget.slug);
        setLoadState("error");
      });
  }

  function showPreview() {
    cancelTimer(closeTimerRef);
    setOpen(true);
    loadPreview();
  }

  function scheduleOpen() {
    cancelTimer(closeTimerRef);
    cancelTimer(openTimerRef);
    openTimerRef.current = window.setTimeout(showPreview, 100);
  }

  function scheduleClose() {
    cancelTimer(openTimerRef);
    cancelTimer(closeTimerRef);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 180);
  }

  function handlePointerEnter(event: PointerEvent<HTMLAnchorElement>) {
    onPointerEnter?.(event);
    if (!event.defaultPrevented && event.pointerType === "mouse") {
      scheduleOpen();
    }
  }

  function handlePointerLeave(event: PointerEvent<HTMLAnchorElement>) {
    onPointerLeave?.(event);
    if (!event.defaultPrevented && event.pointerType === "mouse") {
      scheduleClose();
    }
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (lastPointerTypeRef.current === "touch" && !open) {
      event.preventDefault();
      showPreview();
    }
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            {mobileLayout ? (
              <button
                type="button"
                aria-label="Fermer l’aperçu du parcours"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[119] cursor-default bg-[#071A17]/35 backdrop-blur-[1px]"
              />
            ) : null}
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Aperçu rapide du parcours"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") {
                  cancelTimer(closeTimerRef);
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") {
                  scheduleClose();
                }
              }}
              onFocusCapture={() => cancelTimer(closeTimerRef)}
              onBlurCapture={scheduleClose}
              className="fixed z-[120] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-[#315B3E]/15 bg-[#F9FCFA] text-left text-[#0B302B] shadow-[0_24px_80px_rgba(7,26,23,0.34)]"
              style={position}
            >
              <PreviewContent
                href={href}
                target={previewTarget}
                preview={preview}
                loadState={loadState}
                mobileLayout={mobileLayout}
                onClose={() => setOpen(false)}
                onRetry={loadPreview}
              />
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <NextLink
        {...props}
        ref={setTriggerRef}
        href={href}
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-race-preview-trigger=""
        onBlur={(event) => {
          onBlur?.(event);
          if (!event.defaultPrevented) scheduleClose();
        }}
        onClick={handleClick}
        onFocus={(event) => {
          onFocus?.(event);
          if (!event.defaultPrevented) showPreview();
        }}
        onPointerDown={(event) => {
          lastPointerTypeRef.current = event.pointerType;
          onPointerDown?.(event);
        }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {children}
      </NextLink>
      {panel}
    </>
  );
});

function PreviewContent({
  href,
  target,
  preview,
  loadState,
  mobileLayout,
  onClose,
  onRetry,
}: {
  href: LinkProps["href"];
  target: RaceQuickPreviewTarget;
  preview: RaceQuickPreview | null;
  loadState: "idle" | "loading" | "loaded" | "error";
  mobileLayout: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  const stages = preview
    ? getVisibleStages(preview, target.stageNumber)
    : [];
  const contextLabel = getContextLabel(preview, target);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(135deg,#071A17,#176951)] px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8FE0C6]">
              Aperçu parcours
            </p>
            <p className="mt-1 truncate text-lg font-black">
              {preview?.name ?? "Chargement…"}
            </p>
            <p className="mt-1 text-xs font-bold text-[#C4D7CE]">
              {contextLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’aperçu"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-lg font-black transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          >
            ×
          </button>
        </div>
      </header>

      <div className="p-3 sm:p-4">
        {loadState === "error" ? (
          <div className="rounded-xl border border-[#C94F4F]/20 bg-[#FFF0EE] p-4">
            <p className="text-sm font-black text-[#8A2F2F]">
              Aperçu momentanément indisponible.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 text-xs font-black text-[#176951] underline"
            >
              Réessayer
            </button>
          </div>
        ) : preview ? (
          stages.length > 0 ? (
            <div className="space-y-2.5">
              {stages.map((stage) => (
                <StageProfileSummary
                  key={stage.id}
                  stage={stage}
                  showStageNumber={
                    preview.raceFormat === "stage_race"
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[#315B3E]/20 bg-white px-4 py-5 text-center text-xs font-bold text-[#688176]">
              Le profil de cette étape n’est pas disponible.
            </p>
          )
        ) : (
          <div
            aria-label="Chargement de l’aperçu du parcours"
            className="animate-pulse space-y-2.5"
          >
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="rounded-xl border border-[#315B3E]/8 bg-white p-3"
              >
                <div className="h-3 w-2/3 rounded bg-[#DCE9E3]" />
                <div className="mt-3 h-16 rounded-lg bg-[#E8F1ED]" />
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#315B3E]/12 bg-white px-4 py-3">
        <p className="text-[9px] font-semibold leading-4 text-[#789087]">
          {mobileLayout
            ? "Touchez le bouton pour ouvrir la page complète."
            : "Échap pour fermer · le lien reste accessible."}
        </p>
        <NextLink
          href={href}
          onClick={onClose}
          className="shrink-0 rounded-full bg-[#176951] px-3 py-2 text-[10px] font-black text-white transition hover:bg-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          {target.stageNumber === null
            ? "Ouvrir la course"
            : "Ouvrir l’étape"}
        </NextLink>
      </footer>
    </>
  );
}

function StageProfileSummary({
  stage,
  showStageNumber,
}: {
  stage: RaceQuickPreviewStage;
  showStageNumber: boolean;
}) {
  const cobbles = summarizeCobbles(stage.segments);

  return (
    <section className="rounded-xl border border-[#315B3E]/12 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-[#0B302B]">
            {showStageNumber ? `E${stage.stageNumber} · ` : ""}
            {stage.name}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.09em] text-[#688176]">
            {RACE_PROFILE_LABELS[stage.profileType]} ·{" "}
            {formatDistance(stage.distanceKm)} km
          </p>
        </div>
        {cobbles.sectorCount > 0 ? (
          <span className="shrink-0 rounded-full bg-[#EEE8DF] px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#765E45]">
            {cobbles.sectorCount} secteur
            {cobbles.sectorCount > 1 ? "s" : ""} ·{" "}
            {formatDistance(cobbles.distanceKm)} km pavés
          </span>
        ) : null}
      </div>
      <div className="mt-1.5">
        <RaceStageProfile segments={stage.segments} compact />
      </div>
    </section>
  );
}

function getVisibleStages(
  preview: RaceQuickPreview,
  stageNumber: number | null,
) {
  return stageNumber === null
    ? preview.stages
    : preview.stages.filter(
        (stage) => stage.stageNumber === stageNumber,
      );
}

function getContextLabel(
  preview: RaceQuickPreview | null,
  target: RaceQuickPreviewTarget,
) {
  if (!preview) return "Lecture du tracé…";
  if (target.stageNumber !== null) {
    return `Étape ${target.stageNumber}`;
  }
  if (preview.raceFormat === "stage_race") {
    return `${preview.stages.length} étape${
      preview.stages.length > 1 ? "s" : ""
    } · profils superposés`;
  }
  return "Course d’un jour · profil complet";
}

function getPreview(slug: string) {
  const cached = previewRequests.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.request;
  }

  if (cached) {
    previewRequests.delete(slug);
  }

  const request = fetch(
    `/api/races/${encodeURIComponent(slug)}/preview`,
    {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    },
  ).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `Race preview request failed with ${response.status}.`,
      );
    }

    return (await response.json()) as RaceQuickPreview;
  });
  previewRequests.set(slug, {
    expiresAt: Date.now() + 60_000,
    request,
  });
  return request;
}

function cancelTimer(ref: { current: number | null }) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

function formatDistance(value: number) {
  return value.toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}
