"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  formatSeasonPerformanceButtonLabel,
  type RiderNotablePerformance,
} from "@/lib/game/rider-notable-performances";

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
};

export function SeasonPerformancesPopover({
  seasonName,
  gameYear,
  performances,
}: {
  seasonName: string;
  gameYear: number;
  performances: RiderNotablePerformance[];
}) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({
    left: 12,
    top: 12,
    width: 340,
  });
  const buttonLabel = formatSeasonPerformanceButtonLabel({
    seasonName,
    gameYear,
  });

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 260;
      const viewportPadding = 12;
      const width = Math.min(360, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        window.innerWidth - width - viewportPadding,
        Math.max(
          viewportPadding,
          rect.left + rect.width / 2 - width / 2
        )
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
        className="group inline-flex min-h-9 items-center gap-2 rounded-full border border-[#278B70]/25 bg-[#E9F5F0] px-3 py-1.5 text-[11px] font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:border-[#278B70]/45 hover:bg-[#DDF1E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
      >
        <span
          aria-hidden="true"
          className="grid h-5 w-5 place-items-center rounded-full bg-[#176951] text-[10px] text-white transition group-hover:bg-[#278B70]"
        >
          ★
        </span>
        {buttonLabel}
        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] text-[#48665F]">
          {performances.length}
        </span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="tooltip"
              onMouseEnter={cancelScheduledClose}
              onMouseLeave={scheduleClose}
              className="fixed z-[100] overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] text-left text-white shadow-[0_24px_70px_rgba(7,26,23,0.34)]"
              style={position}
            >
              <div className="border-b border-white/10 bg-white/[0.045] px-4 py-3">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7CCF9C]">
                  Résultats notables
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="font-black text-[#FFFDF4]">{seasonName}</p>
                  <span className="text-[10px] font-bold text-[#9FB5A8]">
                    Top {performances.length || "—"}
                  </span>
                </div>
              </div>

              {performances.length > 0 ? (
                <ol className="max-h-80 divide-y divide-white/10 overflow-y-auto">
                  {performances.map((performance, index) => (
                    <li
                      key={performance.raceEditionId}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-4 py-3"
                    >
                      <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-black text-[#9BE0BC]">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-white">
                          {performance.raceName}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {performance.labels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-[#C7D9D0]"
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="whitespace-nowrap rounded-lg bg-[#F2C94C]/15 px-2 py-1 text-[10px] font-black text-[#F2C94C]">
                        +{performance.uciPoints} pts
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-5 py-6 text-center text-xs font-semibold leading-5 text-[#BFD1C6]">
                  Aucune performance ayant rapporté des points UCI sur cette saison.
                </p>
              )}

              <p className="border-t border-white/10 px-4 py-2.5 text-[9px] font-semibold text-[#8FA99D]">
                Classement établi selon les points UCI réellement gagnés.
              </p>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
