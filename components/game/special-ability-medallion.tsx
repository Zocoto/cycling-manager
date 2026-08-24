"use client";

import { useEffect, useRef, useState } from "react";

import type { SpecialAbilityDefinition } from "@/lib/game/special-abilities";

const UNLOCKED_TONES: Record<SpecialAbilityDefinition["tone"], string> = {
  silver: "border-[#BFC7CA] bg-[linear-gradient(145deg,#F8FAFA,#9DA9AD)] text-[#26383A] shadow-[#768387]/25",
  gold: "border-[#F2C94C] bg-[linear-gradient(145deg,#FFF4A8,#D39B12)] text-[#5C4100] shadow-[#C38E08]/30",
  copper: "border-[#C77C4A] bg-[linear-gradient(145deg,#F3C39E,#9C542E)] text-[#4B2615] shadow-[#8D4726]/30",
  anthracite: "border-[#626B6B] bg-[linear-gradient(145deg,#667070,#222929)] text-white shadow-black/25",
  red: "border-[#E45D5D] bg-[linear-gradient(145deg,#FF9A8E,#B72F36)] text-white shadow-[#A6242D]/30",
  purple: "border-[#9A6DD1] bg-[linear-gradient(145deg,#CEAAEE,#6E3BA0)] text-white shadow-[#5B278D]/30",
  green: "border-[#42B99A] bg-[linear-gradient(145deg,#9BE0BC,#278B70)] text-[#07302A] shadow-[#176951]/30",
  slate: "border-[#56616A] bg-[linear-gradient(145deg,#6C7881,#20272C)] text-[#F3F5F6] shadow-black/35",
  teal: "border-[#2F9FA3] bg-[linear-gradient(145deg,#A6E4E0,#14666B)] text-[#052F33] shadow-[#0D5054]/35",
  pink: "border-[#E680A8] bg-[linear-gradient(145deg,#FFD2E2,#D65789)] text-[#5A1732] shadow-[#B93C6D]/35",
  cobalt: "border-[#3478FF] bg-[linear-gradient(145deg,#A7EDFF,#2458E6)] text-[#071A52] shadow-[#1742B8]/35",
  lime: "border-[#A8D832] bg-[linear-gradient(145deg,#F0FF9B,#4F941D)] text-[#173A08] shadow-[#3B7413]/35",
  earth_sky: "border-[#E0713D] bg-[linear-gradient(145deg,#6EDDEB_0%,#F3B65F_52%,#8B4028_100%)] text-[#32180F] shadow-[#71321E]/35",
  iridescent: "border-[#8B7CF6] bg-[linear-gradient(135deg,#FBCFE8_0%,#C4B5FD_38%,#99F6E4_70%,#BFDBFE_100%)] text-[#25205C] shadow-[#6156C7]/30",
};

export function SpecialAbilityMedallion({
  ability,
  unlocked,
}: {
  ability: SpecialAbilityDefinition;
  unlocked: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = `ability-${ability.code}`;

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [isOpen]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="group relative inline-flex cursor-help rounded-full border-0 bg-transparent p-0 text-inherit"
      aria-label={`${ability.name}${unlocked ? " débloquée" : " non débloquée"}`}
      aria-describedby={tooltipId}
      aria-controls={tooltipId}
      aria-expanded={isOpen}
      onClick={() => setIsOpen((open) => !open)}
      onBlur={() => setIsOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
          event.currentTarget.blur();
        }
      }}
    >
      <span
        aria-hidden="true"
        className={`grid h-12 w-12 place-items-center rounded-full border-2 shadow-lg transition group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5 ${
          isOpen
            ? "-translate-y-0.5 ring-2 ring-[#082A2A]/25 ring-offset-2"
            : ""
        } ${
          unlocked
            ? UNLOCKED_TONES[ability.tone]
            : "border-[#AEBBB6] bg-[#DCE3E0] text-[#7C8C86] grayscale opacity-55 shadow-black/10"
        }`}
      >
        <AbilityIcon icon={ability.icon} />
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className={`mobile-dock-clearance pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#071A17] px-3 py-2.5 text-left text-xs leading-5 text-[#D6DFD2] shadow-2xl transition max-sm:fixed max-sm:inset-x-4 max-sm:bottom-4 max-sm:left-auto max-sm:w-auto max-sm:translate-x-0 ${
          isOpen
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
        }`}
      >
        <strong className="block font-black text-[#F2C94C]">{ability.name}</strong>
        <span className="mt-0.5 block">{ability.effect}</span>
        {!unlocked ? (
          <span className="mt-1 block font-bold text-[#9FB5A8]">Non débloquée</span>
        ) : null}
      </span>
    </button>
  );
}

function AbilityIcon({ icon }: { icon: SpecialAbilityDefinition["icon"] }) {
  if (icon === "velodrome") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="16" cy="16" rx="12" ry="8" /><ellipse cx="16" cy="16" rx="7.5" ry="3.8" /><path d="M4.7 17.8c4.5-2.7 18.1-2.7 22.6 0M6.8 11.2c4.8 2.4 13.6 2.4 18.4 0" opacity=".7" /><path d="m18.8 9.8-4 6h3.5l-4.2 6.4" strokeWidth="2.4" /></svg>;
  }
  if (icon === "lungs") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4v8l-3.2 3.2M17 4v8l3.2 3.2" /><path d="M11.8 10.5c-3.6.9-6.3 5.4-6.3 10.1 0 3.8 1.8 6.1 4.5 6.1 3.5 0 5-3.6 5-8.2V12M20.2 10.5c3.6.9 6.3 5.4 6.3 10.1 0 3.8-1.8 6.1-4.5 6.1-3.5 0-5-3.6-5-8.2V12" /><path d="M16 15c-2 1.5-3.1 4.1-2.5 6.5.4 1.9 1.3 3.1 2.5 4 1.2-.9 2.1-2.1 2.5-4 .6-2.4-.5-5-2.5-6.5Z" fill="currentColor" fillOpacity=".2" /></svg>;
  }
  if (icon === "cyclocross") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="16" cy="16" r="10.2" /><circle cx="16" cy="16" r="5.8" /><path d="M16 5.8v4M16 22.2v4M5.8 16h4M22.2 16h4M8.8 8.8l2.8 2.8M20.4 20.4l2.8 2.8M23.2 8.8l-2.8 2.8M11.6 20.4l-2.8 2.8" /><path d="m13.6 13.4 2.4 2.5 2.4-2.5M13.6 18.6l2.4-2.5 2.4 2.5" /><path d="M5 7.5 3.5 6M6.5 5 6 2.8M26.2 24.8l2.3 1.1M24.8 27l.5 2.2" strokeWidth="2.2" /></svg>;
  }
  if (icon === "metronome") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 27h14L20 6h-8L9 27Z" /><path d="M7 27h18M16 22l4-13" strokeWidth="2.2" /><circle cx="19.2" cy="11.8" r="1.8" fill="currentColor" /><path d="M12.5 22h7M13.3 18.5h5.4M9.2 9.5 6.8 7.8M22.8 9.5l2.4-1.7" opacity=".8" /></svg>;
  }
  if (icon === "fireworks") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round"><path d="M16 15V4M16 4l-3 4m3-4 3 4M11 17 4 10m7 7-5-1m5 1-1-5M21 17l7-7m-7 7 5-1m-5 1 1-5M16 20v8M12 24h8" /></svg>;
  }
  if (icon === "bottle") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinejoin="round"><path d="M12 4h8v5l3 4v13H9V13l3-4V4Z" /><path d="M12 9h8M9 16h14" /></svg>;
  }
  if (icon === "locomotive") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 23h20M9 23V12h12v11M21 16h4v7M12 12V8h6v4M8 27h16" /><circle cx="11" cy="24" r="3" /><circle cx="22" cy="24" r="3" /><path d="M24 12c3-2 3-5 0-7M21 10c2-2 1-4-1-5" /></svg>;
  }
  if (icon === "pump") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h12M9 8v6h6V8M12 14v12M7 26h10M18 19h5c3 0 4-2 4-4" /><path d="m25 11 3 4-3 4" /></svg>;
  }
  if (icon === "potato") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-current stroke-current" strokeWidth="1.5"><path d="M24.5 8.8c4.2 4.5 3.3 12.8-2.2 16.4-5.2 3.4-13.6 1.1-16.2-4.7C3.8 15.3 7.7 7.7 14 6.4c3.7-.8 7.9-.3 10.5 2.4Z" opacity=".45" /><circle cx="12" cy="12" r="1" /><circle cx="20" cy="11" r="1" /><circle cx="18" cy="21" r="1" /></svg>;
  }
  if (icon === "walking_cane") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 5c4 0 6 2 6 5s-2 5-5 5h-3" /><path d="M18 10v16c0 2-1 3-3 3s-3-1-3-3" /><path d="M14 11h8" /></svg>;
  }
  if (icon === "ruler") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9h22v14H5z" /><path d="M9 9v5M13 9v3M17 9v5M21 9v3M25 9v5" /><circle cx="10" cy="19" r="1.5" /></svg>;
  }
  if (icon === "baby_bottle") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h6l1 4-2 3v3c3 1 5 4 5 7v5H9v-5c0-3 2-6 5-7v-3l-2-3 1-4Z" /><path d="M12 8h8M14 14h4M9 21h14" /><path d="M15 4c0-1 1-2 1-2s1 1 1 2" /></svg>;
  }
  if (icon === "sandwich") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinejoin="round"><path d="m5 11 11-6 11 6-11 6L5 11Z" /><path d="m5 17 11 6 11-6M5 21l11 6 11-6" /><path d="m6 14 10 6 10-6" /></svg>;
  }

  return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4c4 1 6 4 6 8v5l5 4-3 7h-7l-2-6-4-2 3-5V8l2-4Z" /><path d="m13 17 6 1M12 22h10" /></svg>;
}
