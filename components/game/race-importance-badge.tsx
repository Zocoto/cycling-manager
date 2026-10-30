import type { RaceImportance } from "@/lib/game/race-calendar";

const RACE_IMPORTANCE_BADGE = {
  grand_tour: {
    label: "Grand Tour",
    compactLabel: "GT",
    symbol: "★",
    className:
      "border-[#8C6A00] bg-[#F2C94C] text-[#1D2A20] shadow-[0_2px_0_rgba(120,88,0,0.24)]",
  },
  monument: {
    label: "Monument",
    compactLabel: "MNT",
    symbol: "◆",
    className:
      "border-[#4C1D95] bg-[#6D28D9] text-white shadow-[0_2px_0_rgba(76,29,149,0.2)]",
  },
} satisfies Record<
  RaceImportance,
  {
    label: string;
    compactLabel: string;
    symbol: string;
    className: string;
  }
>;

export function RaceImportanceBadge({
  importance,
  compact = false,
}: {
  importance: RaceImportance;
  compact?: boolean;
}) {
  const presentation = RACE_IMPORTANCE_BADGE[importance];

  return (
    <span
      data-race-importance-badge={importance}
      aria-label={`Course majeure : ${presentation.label}`}
      title={`Course majeure · ${presentation.label}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-black uppercase tracking-[0.08em] ${presentation.className} ${
        compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[9px]"
      }`}
    >
      <span aria-hidden="true">{presentation.symbol}</span>
      {compact ? presentation.compactLabel : presentation.label}
    </span>
  );
}
