"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getEquipmentCategory } from "@/lib/game/equipment";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import type { StageEquipmentSnapshot } from "@/lib/game/race-stage-equipment";

export function RaceStageEquipmentBadge({ riderName, snapshot }: {
  riderName: string;
  snapshot: StageEquipmentSnapshot;
}) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFocus = useRef(false);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 320 });

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function closeAndFocus() {
    cancelClose();
    pinned.current = false;
    setOpen(false);
    skipFocus.current = true;
    buttonRef.current?.focus({ preventScroll: true });
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
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      const height = panelRef.current?.offsetHeight ?? 300;
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
      const top = rect.bottom + height + 8 <= window.innerHeight - 12
        ? rect.bottom + 8 : Math.max(12, rect.top - height - 8);
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
    function closeOutside(event: Event) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        pinned.current = false;
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      pinned.current = false;
      setOpen(false);
      skipFocus.current = true;
      buttonRef.current?.focus({ preventScroll: true });
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

  if (snapshot.items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-stage-equipment-badge="true"
        aria-label={`Montage spécifique à l’étape · ${riderName} : voir les bonus de notes`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => { cancelClose(); pinned.current = true; setOpen(true); }}
        onFocus={(event) => {
          if (skipFocus.current) { skipFocus.current = false; return; }
          if (event.currentTarget.matches(":focus-visible")) { cancelClose(); pinned.current = true; setOpen(true); }
        }}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") { cancelClose(); setOpen(true); } }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}
        className="inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
      >
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-[#7AAFC9]/50 bg-[#E6F2F8] text-[#28627D] transition hover:bg-[#D4EAF5]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 17 5-9 5 9H4Zm5-9h8l-3 9M7 5h4M9 5v3m8 0 3 9m-3-9-1-3h-3" />
          </svg>
        </span>
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={`Bonus du montage de l’étape · ${riderName}`}
          onPointerEnter={cancelClose}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}
          className="fixed z-[100] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-[#315B3E]/15 bg-white p-4 text-left text-[#173E35] shadow-[0_20px_60px_rgba(7,26,23,0.25)]"
          style={position}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#28627D]">Montage spécifique à l’étape</p>
              <p className="mt-1 text-sm font-black">{riderName}</p>
            </div>
            <button type="button" onClick={closeAndFocus} aria-label="Fermer le détail du matériel" className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-[#688176] hover:bg-[#EAF5F3]">×</button>
          </div>
          <div className="mt-3 rounded-xl bg-[#EAF5F3] p-3">
            <p className="text-xs font-black">Écart avec le montage habituel</p>
            <RatingBonuses bonuses={snapshot.ratingChanges} emptyLabel="Pas de différence sur les notes pour cette étape." />
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-black">Bonus matériel appliqués en course</p>
            <RatingBonuses bonuses={snapshot.ratingBonuses} emptyLabel="Aucun bonus de note actif sur cette étape." />
            <p className="mt-1 text-[10px] leading-4 text-[#688176]">Total du montage, matériel habituel inclus. Bonus CLM uniquement sur les étapes CLM ; efficacité du staff incluse.</p>
          </div>
          <div className="mt-3 border-t border-[#315B3E]/10 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#688176]">Matériel changé pour cette étape</p>
            <ul className="mt-1 space-y-1 text-[11px] leading-4 text-[#48665F]">
              {snapshot.items.map((item) => <li key={item.slot}><span className="font-semibold">{getEquipmentCategory(item.slot).shortLabel}</span> · {item.name ?? "Sans équipement"}</li>)}
            </ul>
            <p className="mt-2 text-[9px] leading-4 text-[#688176]">Montage figé au départ : les changements ultérieurs ne modifient pas ce détail.</p>
          </div>
        </div>, document.body,
      ) : null}
    </>
  );
}

function RatingBonuses({ bonuses, emptyLabel }: {
  bonuses: StageEquipmentSnapshot["ratingBonuses"];
  emptyLabel: string;
}) {
  const axes = RIDER_RATING_AXES.filter(({ key }) => (bonuses[key] ?? 0) !== 0);
  if (axes.length === 0) return <p className="mt-2 text-[11px] leading-4 text-[#688176]">{emptyLabel}</p>;
  return <div className="mt-2 flex flex-wrap gap-1.5">
    {axes.map(({ key, label, shortLabel }) => {
      const value = bonuses[key]!;
      const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Math.abs(value));
      return <span key={key} title={label} aria-label={`${label} : ${value > 0 ? "+" : "−"}${formatted}`} className={`rounded-lg border px-2 py-1 text-xs font-black ${value > 0 ? "border-[#278B70]/20 bg-white text-[#176951]" : "border-[#A33A3A]/20 bg-[#FFF4F4] text-[#A33A3A]"}`}>{value > 0 ? "+" : "−"}{formatted} {shortLabel}</span>;
    })}
  </div>;
}
