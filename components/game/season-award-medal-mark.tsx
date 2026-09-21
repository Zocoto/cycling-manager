import {
  SEASON_AWARD_PRESENTATION,
  type SeasonAwardIcon,
  type SeasonAwardKey,
  type SeasonAwardTone,
} from "@/lib/game/season-awards";

const TONE_CLASSES: Record<SeasonAwardTone, string> = {
  gold: "border-[#F5D56A] bg-[linear-gradient(145deg,#FFF3AC,#B97A0C)] text-[#513300] shadow-[#A56A08]/35",
  emerald: "border-[#77D6B0] bg-[linear-gradient(145deg,#C8F4DD,#168463)] text-[#063E31] shadow-[#0B674B]/35",
  ruby: "border-[#F08B91] bg-[linear-gradient(145deg,#FFD0CC,#B7283D)] text-[#5B0B17] shadow-[#8F1B2D]/35",
  violet: "border-[#C3A0EE] bg-[linear-gradient(145deg,#E9DAFA,#7041A7)] text-[#321653] shadow-[#58308B]/35",
  cobalt: "border-[#82B4FF] bg-[linear-gradient(145deg,#D9EDFF,#3266D6)] text-[#102B61] shadow-[#214EAF]/35",
  amber: "border-[#F2BA67] bg-[linear-gradient(145deg,#FFE4AC,#B86113)] text-[#542700] shadow-[#98480E]/35",
  teal: "border-[#77DCE0] bg-[linear-gradient(145deg,#D0F7F4,#18737A)] text-[#073B3E] shadow-[#115C62]/35",
  rose: "border-[#F3A4C2] bg-[linear-gradient(145deg,#FFE0EB,#C64678)] text-[#611B37] shadow-[#A3315E]/35",
  slate: "border-[#B9C2C9] bg-[linear-gradient(145deg,#F1F4F5,#66727B)] text-[#263238] shadow-black/25",
};

export function SeasonAwardMedalMark({
  awardKey,
  className = "h-14 w-14",
}: {
  awardKey: SeasonAwardKey;
  className?: string;
}) {
  const presentation = SEASON_AWARD_PRESENTATION[awardKey];

  return (
    <span
      aria-hidden="true"
      data-season-award-medal={awardKey}
      className={`relative grid shrink-0 place-items-center rounded-full border-[3px] shadow-lg ring-2 ring-white/35 ring-offset-1 ring-offset-transparent ${TONE_CLASSES[presentation.tone]} ${className}`}
    >
      <span className="absolute -bottom-2 left-1/2 h-5 w-7 -translate-x-1/2 bg-current opacity-55 [clip-path:polygon(10%_0,90%_0,76%_100%,50%_72%,24%_100%)]" />
      <span className="relative z-10 grid h-[72%] w-[72%] place-items-center rounded-full border border-white/45 bg-white/20">
        <AwardIcon icon={presentation.icon} />
      </span>
    </span>
  );
}

function AwardIcon({ icon }: { icon: SeasonAwardIcon }) {
  const shared = "h-7 w-7 fill-none stroke-current";
  const props = {
    "aria-hidden": true,
    viewBox: "0 0 32 32",
    className: shared,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (icon === "crown") return <svg {...props}><path d="m5 10 6 5 5-9 5 9 6-5-3 14H8L5 10Z" /><path d="M9 27h14" /></svg>;
  if (icon === "team") return <svg {...props}><circle cx="16" cy="10" r="4" /><circle cx="7" cy="13" r="3" /><circle cx="25" cy="13" r="3" /><path d="M9 27v-3c0-4 3-7 7-7s7 3 7 7v3M2 27v-2c0-3 2-6 6-6M30 27v-2c0-3-2-6-6-6" /></svg>;
  if (icon === "bouquet") return <svg {...props}><path d="M16 27V14M16 20l-6-5M16 19l6-5" /><circle cx="16" cy="9" r="4" /><circle cx="9" cy="12" r="4" /><circle cx="23" cy="12" r="4" /></svg>;
  if (icon === "spark") return <svg {...props}><path d="m16 3 2.8 8.2L27 14l-8.2 2.8L16 25l-2.8-8.2L5 14l8.2-2.8L16 3Z" /><path d="m25 4 .8 2.2L28 7l-2.2.8L25 10l-.8-2.2L22 7l2.2-.8L25 4Z" /></svg>;
  if (icon === "tactics") return <svg {...props}><rect x="4" y="5" width="24" height="22" rx="3" /><circle cx="10" cy="11" r="2" /><circle cx="22" cy="12" r="2" /><circle cx="14" cy="21" r="2" /><path d="m12 12 8-1M11 13l2 6M21 14l-5 6" /></svg>;
  if (icon === "crutch") return <svg {...props}><path d="M20 4c4 0 6 2 6 5s-2 5-5 5h-3M18 9v17c0 2-1 3-3 3s-3-1-3-3M14 11h8" /></svg>;
  if (icon === "medical") return <svg {...props}><path d="M11 4h10v7h7v10h-7v7H11v-7H4V11h7V4Z" /><path d="M13 16h6" /></svg>;
  if (icon === "lantern" || icon === "lanterns") return <svg {...props}><path d="M11 8h10l2 16H9l2-16Z" /><path d="M13 8V5h6v3M8 27h16M12 16h8M14 13h4v7h-4z" />{icon === "lanterns" ? <path d="M5 11 3 23h4M27 11l2 12h-4" /> : null}</svg>;
  if (icon === "handshake") return <svg {...props}><path d="m4 17 5-6 6 2 3-2 10 8-4 5-4-2-3 3-3-2-3 1-7-7Z" /><path d="m11 15 4 3 3-3 6 5M8 20l3 3M14 23l2 2M20 22l2 2" /></svg>;
  if (icon === "sudoku" || icon === "crossword") return <svg {...props}><rect x="4" y="4" width="24" height="24" rx="2" /><path d="M12 4v24M20 4v24M4 12h24M4 20h24" />{icon === "sudoku" ? <path d="M7 9h2M15 17h2M23 25h2M23 9h2M7 25h2" /> : <path d="M5 5h6v6H5zM13 13h6v6h-6zM21 21h6v6h-6z" fill="currentColor" stroke="none" />}</svg>;
  if (icon === "builder") return <svg {...props}><path d="M5 28V5h14M10 5v23M10 9h16M19 5l7 4M22 9v11M19 20h6v4h-6z" /><path d="M4 28h24M10 14h8M10 20h6" /></svg>;
  if (icon === "microphone") return <svg {...props}><rect x="11" y="4" width="10" height="16" rx="5" /><path d="M7 15v1a9 9 0 0 0 18 0v-1M16 25v4M11 29h10" /></svg>;
  if (icon === "chat") return <svg {...props}><path d="M5 6h22v16H14l-6 5v-5H5V6Z" /><path d="M10 12h12M10 17h8" /></svg>;
  if (icon === "academy") return <svg {...props}><path d="M16 28V13M16 20c-5 0-9-3-9-8 5 0 9 3 9 8ZM16 16c5 0 9-3 9-8-5 0-9 3-9 8Z" /><path d="M9 28h14" /></svg>;
  if (icon === "junior") return <svg {...props}><circle cx="16" cy="10" r="5" /><path d="M8 28c0-7 3-11 8-11s8 4 8 11M5 7l3 2M27 7l-3 2M16 2v3" /><path d="m13 10 2 2 4-4" /></svg>;
  if (icon === "podium") return <svg {...props}><path d="M4 27h24M5 19h7v8H5zM12 13h8v14h-8zM20 17h7v10h-7z" /><path d="m16 5 1.2 2.5L20 8l-2 2 .5 3-2.5-1.4-2.5 1.4.5-3-2-2 2.8-.5L16 5Z" /></svg>;
  return <svg {...props}><path d="M16 27C6 21 4 16 4 11a6 6 0 0 1 11-3 6 6 0 0 1 13 3c0 5-2 10-12 16Z" /></svg>;
}
