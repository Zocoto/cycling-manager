"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import type { FederationSponsorPreview } from "@/services/federation-sponsors";

export function FederationSponsorsPopover({
  countryName,
  counterLabel,
  sponsors,
}: {
  countryName: string;
  counterLabel: string;
  sponsors: readonly FederationSponsorPreview[];
}) {
  const panelId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const skipFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function close() {
    cancelClose();
    pinned.current = false;
    setOpen(false);
  }

  function closeAndFocus() {
    close();
    if (document.activeElement !== buttonRef.current) {
      skipFocus.current = true;
      buttonRef.current?.focus({ preventScroll: true });
    }
  }

  function scheduleClose() {
    if (pinned.current) return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }

  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const button = buttonRef.current;
      const panel = panelRef.current;
      if (!button || !panel) return;
      const rect = button.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
      const top = rect.bottom + height + 8 <= window.innerHeight - 12
        ? rect.bottom + 8
        : Math.max(12, rect.top - height - 8);
      setPosition({ left, top });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: Event) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        cancelClose();
        pinned.current = false;
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      cancelClose();
      pinned.current = false;
      setOpen(false);
      if (document.activeElement !== buttonRef.current) {
        skipFocus.current = true;
        buttonRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Voir les sponsors nationaux · ${countryName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") { cancelClose(); setOpen(true); }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") scheduleClose();
        }}
        onFocus={(event) => {
          if (skipFocus.current) { skipFocus.current = false; return; }
          if (event.currentTarget.matches(":focus-visible")) {
            cancelClose(); pinned.current = true; setOpen(true);
          }
        }}
        onClick={(event) => {
          if (open && pinned.current && event.detail !== 0) { close(); return; }
          cancelClose(); pinned.current = true; setOpen(true);
        }}
        className="inline-flex min-h-9 touch-manipulation items-center gap-2 rounded-md text-left underline decoration-[#789087]/50 decoration-dotted underline-offset-[6px] transition hover:text-[#28715E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-4"
      >
        <span>{counterLabel}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5 opacity-60">
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          onPointerEnter={cancelClose}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}
          className="fixed z-[100] flex max-h-[min(30rem,calc(100dvh-24px))] w-[min(25rem,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white text-left text-[#183F37] shadow-[0_20px_60px_rgba(7,26,23,0.22)]"
          style={position}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#315B3E]/10 bg-[#F3F8F5] px-4 py-3">
            <div>
              <h3 id={titleId} className="text-sm font-black">Sponsors nationaux</h3>
              <p className="mt-0.5 text-xs font-semibold text-[#60756E]">{countryName} · {sponsors.length}</p>
            </div>
            <button type="button" aria-label="Fermer la liste des sponsors" onClick={closeAndFocus} className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl text-[#60756E] hover:bg-[#E4EEE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]">×</button>
          </div>
          {sponsors.length > 0 ? (
            <ul className="min-h-0 overflow-y-auto overscroll-contain divide-y divide-[#315B3E]/10 px-4">
              {sponsors.map((sponsor) => (
                <li key={sponsor.id} className="flex items-center gap-3 py-3">
                  <SponsorLogoMark
                    src={sponsor.logoPath}
                    alt=""
                    sponsorName={sponsor.name}
                    primaryColor={sponsor.colors.primary}
                    backgroundColor={sponsor.colors.background}
                    textColor={sponsor.colors.text}
                    className="h-12 w-20 rounded-lg p-1.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-black leading-5">{sponsor.name}</p>
                    <p className="mt-0.5 text-xs font-medium leading-4 text-[#60756E]">{sponsor.sector}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-5 text-sm text-[#60756E]">Aucun sponsor dans le catalogue national.</p>}
        </div>, document.body,
      ) : null}
    </>
  );
}
