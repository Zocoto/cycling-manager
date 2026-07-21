import {
  getTeamDivisionLabel,
  normalizeTeamDivisionCode,
} from "@/lib/game/team-divisions";

const DIVISION_TONES = {
  elite: "border-[#F2C94C]/55 bg-[#F2C94C]/15 text-[#F8D96A]",
  world: "border-[#9BE0BC]/45 bg-[#42B99A]/15 text-[#9BE0BC]",
  continental: "border-[#7EB7DC]/45 bg-[#4D94C4]/15 text-[#B6DCF5]",
  national: "border-[#D1A77B]/45 bg-[#B47745]/15 text-[#F0CAA3]",
  amateur: "border-white/20 bg-white/10 text-[#D6DFD2]",
} as const;

const LIGHT_DIVISION_TONES = {
  elite: "border-[#C79B18]/30 bg-[#FFF4BF] text-[#7A5B00]",
  world: "border-[#278B70]/25 bg-[#DDF3E7] text-[#176951]",
  continental: "border-[#4D94C4]/25 bg-[#E2F1FA] text-[#2D6F9A]",
  national: "border-[#B47745]/25 bg-[#F8E8D9] text-[#875126]",
  amateur: "border-[#315B3E]/15 bg-[#EEF3F0] text-[#60756E]",
} as const;

export function TeamDivisionBadge({
  division,
  dark = false,
  compact = false,
}: {
  division: string | null | undefined;
  dark?: boolean;
  compact?: boolean;
}) {
  const code = normalizeTeamDivisionCode(division);
  const tone = dark ? DIVISION_TONES[code] : LIGHT_DIVISION_TONES[code];

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border font-black uppercase ${tone} ${
        compact
          ? "px-2 py-0.5 text-[9px] tracking-[0.11em]"
          : "px-3 py-1.5 text-[10px] tracking-[0.14em]"
      }`}
      title="Division attribuée pour la saison en cours"
    >
      Division {getTeamDivisionLabel(code)}
    </span>
  );
}
