import {
  getSquadStatusLabel,
  type SquadStatus,
} from "@/lib/game/squad-status";

export function SquadStatusBadge({
  status,
  tone = "light",
  compact = false,
}: {
  status: SquadStatus | null;
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  return (
    <span
      title={`Statut dans l’effectif : ${getSquadStatusLabel(status)}`}
      className={[
        "inline-flex max-w-full items-center rounded-full border font-black",
        compact
          ? "px-2 py-0.5 text-[9px] uppercase tracking-wide"
          : "px-3 py-1.5 text-xs",
        tone === "dark"
          ? "border-white/15 bg-white/10 text-[#DDF6E8]"
          : status
            ? "border-[#278B70]/20 bg-[#E7F4EF] text-[#176951]"
            : "border-[#60756E]/15 bg-[#F3F6F5] text-[#60756E]",
      ].join(" ")}
    >
      {getSquadStatusLabel(status)}
    </span>
  );
}
