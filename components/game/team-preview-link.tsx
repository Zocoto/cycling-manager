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

import type { TeamQuickPreview } from "@/lib/game/team-quick-preview";

type TeamPreviewLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    teamId: string;
    children?: ReactNode;
    autoOpen?: boolean;
  };

const requests = new Map<string, { expiresAt: number; request: Promise<TeamQuickPreview> }>();

function loadTeamPreview(teamId: string) {
  const cached = requests.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.request;
  const request = fetch(`/api/teams/${encodeURIComponent(teamId)}/preview`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Team preview unavailable: ${response.status}`);
    return (await response.json()) as TeamQuickPreview;
  });
  requests.set(teamId, { expiresAt: Date.now() + 30_000, request });
  void request.catch(() => {
    if (requests.get(teamId)?.request === request) requests.delete(teamId);
  });
  return request;
}

export const TeamPreviewLink = forwardRef<HTMLAnchorElement, TeamPreviewLinkProps>(
  function TeamPreviewLink(
    {
      teamId,
      autoOpen = false,
      children,
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
    const closeTimer = useRef<number | null>(null);
    const lastPointerType = useRef<string | null>(null);
    const [open, setOpen] = useState(autoOpen);
    const [mobile, setMobile] = useState(false);
    const [preview, setPreview] = useState<TeamQuickPreview | null>(null);
    const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
    const [position, setPosition] = useState({ left: 12, top: 12, width: 360 });

    useEffect(() => {
      if (!autoOpen) return;
      setOpen(true);
      setLoadState("loading");
      void loadTeamPreview(teamId)
        .then(setPreview)
        .catch(() => setLoadState("error"));
    }, [autoOpen, teamId]);

    useLayoutEffect(() => {
      if (!open) return;
      function updatePosition() {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const isMobile = window.innerWidth < 640 ||
          window.matchMedia("(hover: none), (pointer: coarse)").matches;
        const width = Math.min(360, window.innerWidth - 24);
        const height = panelRef.current?.offsetHeight ?? 290;
        setMobile(isMobile);
        setPosition({
          left: isMobile ? 12 : Math.max(12, Math.min(window.innerWidth - width - 12, rect.left)),
          top: isMobile
            ? Math.max(12, window.innerHeight - height - 12)
            : rect.bottom + height + 10 < window.innerHeight - 12
              ? rect.bottom + 10
              : Math.max(12, rect.top - height - 10),
          width,
        });
      }
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [open, preview, loadState]);

    useEffect(() => {
      if (!open) return;
      function handleOutside(event: globalThis.PointerEvent) {
        const target = event.target as Node;
        if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
          setOpen(false);
        }
      }
      function handleEscape(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
      document.addEventListener("pointerdown", handleOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("pointerdown", handleOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [open]);

    useEffect(() => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    }, []);

    function show() {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      setOpen(true);
      if (preview || loadState === "loading") return;
      setLoadState("loading");
      void loadTeamPreview(teamId)
        .then(setPreview)
        .catch(() => setLoadState("error"));
    }

    function scheduleClose() {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => setOpen(false), 180);
    }

    const panel = open && typeof document !== "undefined"
      ? createPortal(
          <>
            {mobile ? (
              <button
                type="button"
                aria-label="Fermer l’aperçu de l’équipe"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[119] bg-[#071A17]/35"
              />
            ) : null}
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Aperçu rapide de l’équipe"
              onPointerEnter={() => {
                if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
              }}
              onPointerLeave={scheduleClose}
              onFocusCapture={() => {
                if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
              }}
              onBlurCapture={scheduleClose}
              className="fixed z-[120] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-[#315B3E]/15 bg-[#F9FCFA] text-left text-[#0B302B] shadow-[0_24px_80px_rgba(7,26,23,0.34)]"
              style={position}
            >
              <div className="bg-[linear-gradient(135deg,#071A17,#176951)] px-4 py-4 text-white">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8FE0C6]">Aperçu équipe</p>
                <p className="mt-1 text-lg font-black">{preview?.name ?? "Chargement…"}</p>
                {preview ? <p className="mt-1 text-xs font-semibold text-[#C4D7CE]">{preview.countryName} · {preview.divisionName ?? "Division non renseignée"}</p> : null}
              </div>
              {loadState === "error" ? (
                <p className="p-4 text-xs font-bold text-[#8A2F2F]">Aperçu momentanément indisponible.</p>
              ) : preview ? (
                <div className="grid gap-2 px-4 py-4 text-xs">
                  {preview.sponsorName ? <p><span className="font-black">Sponsor :</span> {preview.sponsorName}</p> : null}
                  {preview.directorName ? <p><span className="font-black">DS :</span> {preview.directorName}</p> : null}
                  {preview.ranking ? <p><span className="font-black">Classement UCI :</span> #{preview.ranking.rank} · {preview.ranking.points.toLocaleString("fr-FR")} points</p> : null}
                </div>
              ) : <div className="h-24 animate-pulse bg-[#E5EFEA]" />}
              <div className="border-t border-[#315B3E]/12 bg-white px-4 py-3 text-right">
                <NextLink
                  href={`/jeu/equipes/${teamId}`}
                  onClick={() => setOpen(false)}
                  className="inline-block rounded-full bg-[#176951] px-3 py-2 text-[10px] font-black text-white"
                >
                  Voir la fiche
                </NextLink>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

    return (
      <>
        <NextLink
          {...props}
          ref={(node) => {
            triggerRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          data-team-preview-trigger=""
          aria-controls={open ? panelId : undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          onBlur={(event) => { onBlur?.(event); if (!event.defaultPrevented) scheduleClose(); }}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
            onClick?.(event);
            if (!event.defaultPrevented && lastPointerType.current === "touch" && !open) {
              event.preventDefault();
              show();
            }
          }}
          onFocus={(event) => { onFocus?.(event); if (!event.defaultPrevented) show(); }}
          onPointerDown={(event) => { lastPointerType.current = event.pointerType; onPointerDown?.(event); }}
          onPointerEnter={(event: PointerEvent<HTMLAnchorElement>) => {
            onPointerEnter?.(event);
            if (!event.defaultPrevented && event.pointerType === "mouse") show();
          }}
          onPointerLeave={(event) => { onPointerLeave?.(event); scheduleClose(); }}
        >
          {children}
        </NextLink>
        {panel}
      </>
    );
  },
);
