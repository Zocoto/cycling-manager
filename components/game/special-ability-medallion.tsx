import type {
  SpecialAbilityDefinition,
} from "@/lib/game/special-abilities";

const UNLOCKED_TONES: Record<SpecialAbilityDefinition["tone"], string> = {
  silver: "border-[#BFC7CA] bg-[linear-gradient(145deg,#F8FAFA,#9DA9AD)] text-[#26383A] shadow-[#768387]/25",
  gold: "border-[#F2C94C] bg-[linear-gradient(145deg,#FFF4A8,#D39B12)] text-[#5C4100] shadow-[#C38E08]/30",
  copper: "border-[#C77C4A] bg-[linear-gradient(145deg,#F3C39E,#9C542E)] text-[#4B2615] shadow-[#8D4726]/30",
  anthracite: "border-[#626B6B] bg-[linear-gradient(145deg,#667070,#222929)] text-white shadow-black/25",
  red: "border-[#E45D5D] bg-[linear-gradient(145deg,#FF9A8E,#B72F36)] text-white shadow-[#A6242D]/30",
  purple: "border-[#9A6DD1] bg-[linear-gradient(145deg,#CEAAEE,#6E3BA0)] text-white shadow-[#5B278D]/30",
  green: "border-[#42B99A] bg-[linear-gradient(145deg,#9BE0BC,#278B70)] text-[#07302A] shadow-[#176951]/30",
};

export function SpecialAbilityMedallion({
  ability,
  unlocked,
}: {
  ability: SpecialAbilityDefinition;
  unlocked: boolean;
}) {
  const tooltipId = `ability-${ability.code}`;

  return (
    <span
      className="group relative inline-flex"
      tabIndex={0}
      aria-describedby={tooltipId}
    >
      <span
        aria-label={`${ability.name}${unlocked ? " débloquée" : " non débloquée"}`}
        className={`grid h-12 w-12 place-items-center rounded-full border-2 shadow-lg transition group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5 ${
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
        className="pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-1/2 z-30 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#071A17] px-3 py-2.5 text-left text-xs leading-5 text-[#D6DFD2] opacity-0 shadow-2xl transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <strong className="block font-black text-[#F2C94C]">{ability.name}</strong>
        <span className="mt-0.5 block">{ability.effect}</span>
        {!unlocked ? (
          <span className="mt-1 block font-bold text-[#9FB5A8]">Non débloquée</span>
        ) : null}
      </span>
    </span>
  );
}

function AbilityIcon({ icon }: { icon: SpecialAbilityDefinition["icon"] }) {
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
  if (icon === "sandwich") {
    return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinejoin="round"><path d="m5 11 11-6 11 6-11 6L5 11Z" /><path d="m5 17 11 6 11-6M5 21l11 6 11-6" /><path d="m6 14 10 6 10-6" /></svg>;
  }

  return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4c4 1 6 4 6 8v5l5 4-3 7h-7l-2-6-4-2 3-5V8l2-4Z" /><path d="m13 17 6 1M12 22h10" /></svg>;
}
