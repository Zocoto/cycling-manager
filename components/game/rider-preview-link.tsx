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

import type { RiderQuickPreview } from "@/lib/game/rider-quick-preview";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";
import { formatScoutedNumericValue } from "@/lib/game/transfer-scouting";

type RiderPreviewLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    riderId: string;
    children?: ReactNode;
  };

type PreviewPosition = {
  left: number;
  top: number;
  width: number;
};

type PreviewRequest = {
  expiresAt: number;
  request: Promise<RiderQuickPreview>;
};

const previewRequests = new Map<string, PreviewRequest>();

export const RiderPreviewLink = forwardRef<
  HTMLAnchorElement,
  RiderPreviewLinkProps
>(function RiderPreviewLink(
  {
    riderId,
    children,
    onBlur,
    onClick,
    onFocus,
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
    ...props
  },
  forwardedRef
) {
  const panelId = useId();
  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const lastPointerTypeRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(false);
  const [preview, setPreview] = useState<RiderQuickPreview | null>(null);
  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [position, setPosition] = useState<PreviewPosition>({
    left: 12,
    top: 12,
    width: 430,
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
      const width = Math.min(430, window.innerWidth - viewportPadding * 2);
      const panelHeight = panelRef.current?.offsetHeight ?? 470;
      const rect = trigger.getBoundingClientRect();
      const left = isMobile
        ? viewportPadding
        : Math.min(
            window.innerWidth - width - viewportPadding,
            Math.max(
              viewportPadding,
              rect.left + rect.width / 2 - width / 2
            )
          );
      const top = isMobile
        ? Math.max(viewportPadding, window.innerHeight - panelHeight - 12)
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
  }, [open, loadState]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideInteraction(event: globalThis.PointerEvent) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
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
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(
    () => () => {
      cancelTimer(openTimerRef);
      cancelTimer(closeTimerRef);
    },
    []
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
    getPreview(riderId)
      .then((loadedPreview) => {
        setPreview(loadedPreview);
        setLoadState("loaded");
      })
      .catch(() => {
        previewRequests.delete(riderId);
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
                aria-label="Fermer l’aperçu du coureur"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[119] cursor-default bg-[#071A17]/35 backdrop-blur-[1px]"
              />
            ) : null}
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Aperçu rapide du coureur"
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
                riderId={riderId}
                preview={preview}
                loadState={loadState}
                mobileLayout={mobileLayout}
                onClose={() => setOpen(false)}
                onRetry={loadPreview}
              />
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <NextLink
        {...props}
        ref={setTriggerRef}
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-rider-preview-trigger=""
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
  riderId,
  preview,
  loadState,
  mobileLayout,
  onClose,
  onRetry,
}: {
  riderId: string;
  preview: RiderQuickPreview | null;
  loadState: "idle" | "loading" | "loaded" | "error";
  mobileLayout: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(135deg,#071A17,#176951)] px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8FE0C6]">
              Aperçu coureur
            </p>
            <p className="mt-1 truncate text-lg font-black">
              {preview?.name ?? "Chargement…"}
            </p>
            {preview ? (
              <p className="mt-1 text-xs font-bold text-[#C4D7CE]">
                <span
                  className={`fi fi-${preview.country.code.toLowerCase()} mr-2 rounded-sm`}
                />
                {preview.country.name}
                {preview.age ? ` · ${preview.age} ans` : ""}
              </p>
            ) : null}
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

      <div className="p-4">
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
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#315B3E]/12 bg-white px-3 py-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#789087]">
                  Équipe actuelle
                </p>
                {preview.team ? (
                  <NextLink
                    href={`/jeu/equipes/${preview.team.id}`}
                    className="mt-1 block truncate text-sm font-black text-[#176951] hover:underline"
                  >
                    {preview.team.name}
                  </NextLink>
                ) : (
                  <p className="mt-1 text-sm font-black text-[#60756E]">
                    Agent libre
                  </p>
                )}
              </div>
              {preview.ratingVisibility === "scouted" ? (
                <span className="shrink-0 rounded-full bg-[#E9E2F4] px-2.5 py-1 text-[9px] font-black uppercase text-[#684397]">
                  Scouting
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#48665F]">
                  Caractéristiques
                </p>
                {preview.ratingVisibility === "scouted" ? (
                  <p className="text-[9px] font-bold text-[#7D5BB1]">
                    Valeurs estimées
                  </p>
                ) : null}
              </div>

              {preview.ratings ? (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {RIDER_RATING_AXES.map((axis) => {
                    const value = preview.ratings![axis.key];
                    const tone =
                      value.kind === "exact"
                        ? getRiderRatingColorClasses(value.value)
                        : "border-[#D9E3DE] bg-white text-[#48665F]";

                    return (
                      <div
                        key={axis.key}
                        title={axis.label}
                        className={`flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 py-1.5 ${tone}`}
                      >
                        <span className="text-[9px] font-extrabold opacity-70">
                          {axis.shortLabel}
                        </span>
                        <span className="mt-0.5 text-xs font-black">
                          {formatScoutedNumericValue(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-[#315B3E]/20 bg-white px-4 py-5 text-center text-xs font-bold text-[#688176]">
                  Aucune statistique disponible pour la saison active.
                </p>
              )}
            </div>
          </>
        ) : (
          <div aria-label="Chargement de l’aperçu" className="animate-pulse">
            <div className="h-14 rounded-xl bg-[#E5EFEA]" />
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {Array.from({ length: 13 }, (_, index) => (
                <div key={index} className="h-12 rounded-lg bg-[#E5EFEA]" />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#315B3E]/12 bg-white px-4 py-3">
        <p className="text-[9px] font-semibold leading-4 text-[#789087]">
          {mobileLayout
            ? "Utilisez « Voir la fiche » pour ouvrir le profil complet."
            : "Échap pour fermer · survolez sans quitter la page."}
        </p>
        <NextLink
          href={`/jeu/coureurs/${riderId}`}
          onClick={onClose}
          className="shrink-0 rounded-full bg-[#176951] px-3 py-2 text-[10px] font-black text-white transition hover:bg-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          Voir la fiche
        </NextLink>
      </footer>
    </>
  );
}

function getPreview(riderId: string) {
  const cached = previewRequests.get(riderId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.request;
  }

  if (cached) {
    previewRequests.delete(riderId);
  }

  const request = fetch(`/api/riders/${encodeURIComponent(riderId)}/preview`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Rider preview request failed with ${response.status}.`);
    }

    return (await response.json()) as RiderQuickPreview;
  });
  previewRequests.set(riderId, {
    expiresAt: Date.now() + 30_000,
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
