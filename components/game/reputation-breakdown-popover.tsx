"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type { SportingDirectorReputationBreakdown } from "@/lib/game/reputation-breakdown";

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
};

export function ReputationBreakdownPopover({
  formattedReputationPoints,
  breakdown,
}: {
  formattedReputationPoints: string;
  breakdown: SportingDirectorReputationBreakdown | null;
}) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({
    left: 12,
    top: 12,
    width: 320,
  });

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 320;
      const viewportPadding = 12;
      const width = Math.min(340, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        window.innerWidth - width - viewportPadding,
        Math.max(viewportPadding, rect.left),
      );
      const preferredTop = rect.bottom + 10;
      const top =
        preferredTop + panelHeight <= window.innerHeight - viewportPadding
          ? preferredTop
          : Math.max(viewportPadding, rect.top - panelHeight - 10);

      setPosition({ left, top, width });
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

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function cancelScheduledClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 140);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`R\u00e9putation : ${formattedReputationPoints} points. Consulter le d\u00e9tail`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => {
          cancelScheduledClose();
          setOpen(true);
        }}
        onFocus={() => {
          cancelScheduledClose();
          setOpen(true);
        }}
        onBlur={scheduleClose}
        onMouseEnter={() => {
          cancelScheduledClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className="group mt-1 inline-flex items-center gap-2 rounded-md text-left text-lg font-black text-[#FFFDF4] underline decoration-[#7CCF9C]/55 decoration-dotted underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B]"
      >
        <span>{formattedReputationPoints} points</span>
        <InformationIcon />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="tooltip"
              onMouseEnter={cancelScheduledClose}
              onMouseLeave={scheduleClose}
              className="fixed z-[100] overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#FFFDF4] text-left text-[#163C34] shadow-[0_24px_70px_rgba(7,26,23,0.34)]"
              style={position}
            >
              <div className="border-b border-[#315B3E]/12 bg-[#EAF5F0] px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                  D&eacute;tail de la r&eacute;putation
                </p>
                <p className="mt-1 text-sm font-black text-[#123C33]">
                  D&rsquo;o&ugrave; viennent vos points
                </p>
              </div>

              {breakdown ? (
                <>
                  {breakdown.items.length > 0 ? (
                    <ul className="divide-y divide-[#315B3E]/10 px-4">
                      {breakdown.items.map((item) => (
                        <li
                          key={item.key}
                          className="flex items-center justify-between gap-4 py-2.5 text-xs"
                        >
                          <span className="font-semibold text-[#526E66]">
                            {item.label}
                          </span>
                          <span
                            className={`shrink-0 font-black ${
                              item.points < 0
                                ? "text-[#B9473B]"
                                : "text-[#176951]"
                            }`}
                          >
                            {formatSignedPoints(item.points)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-5 text-xs font-semibold leading-5 text-[#60756E]">
                      Aucun gain de r&eacute;putation n&rsquo;est encore enregistr&eacute;.
                    </p>
                  )}

                  {breakdown.recentGains.length > 0 ? (
                    <div className="border-t border-[#315B3E]/12 bg-white/65 px-4 py-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#6A817A]">
                        Derniers gains
                      </p>
                      <ol className="mt-2 space-y-2">
                        {breakdown.recentGains.map((gain, index) => (
                          <li
                            key={`${gain.description}-${index}`}
                            className="flex items-start justify-between gap-3 text-[11px] leading-4"
                          >
                            <span className="text-[#526E66]">
                              {gain.description}
                            </span>
                            <span className="shrink-0 font-black text-[#176951]">
                              {formatSignedPoints(gain.points)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-4 border-t border-[#315B3E]/12 bg-[#0B302B] px-4 py-3 text-xs text-white">
                    <span className="font-bold text-[#BFD1C6]">
                      Valeur actuelle
                    </span>
                    <span className="font-black text-[#F2C94C]">
                      {formatPoints(breakdown.currentPoints)} points
                    </span>
                  </div>
                </>
              ) : (
                <p className="px-4 py-5 text-xs font-semibold leading-5 text-[#60756E]">
                  Le d&eacute;tail est momentan&eacute;ment indisponible. La valeur affich&eacute;e
                  reste bien votre r&eacute;putation actuelle.
                </p>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function formatSignedPoints(points: number): string {
  const sign = points < 0 ? "\u2212" : "+";
  return `${sign}${formatPoints(Math.abs(points))} pt${Math.abs(points) > 1 ? "s" : ""}`;
}

function formatPoints(points: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(points);
}

function InformationIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid h-5 w-5 place-items-center rounded-full border border-[#7CCF9C]/45 bg-[#7CCF9C]/10 text-[11px] font-black text-[#9BE0BC] transition group-hover:border-[#9BE0BC]/70 group-hover:bg-[#7CCF9C]/20"
    >
      i
    </span>
  );
}
