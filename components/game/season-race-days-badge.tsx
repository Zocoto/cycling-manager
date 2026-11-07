export function SeasonRaceDaysBadge({
  seasonRaceDays,
  tone = "light",
  className = "",
}: {
  seasonRaceDays?: number | null;
  tone?: "light" | "dark";
  className?: string;
}) {
  if (seasonRaceDays == null) return null;

  return (
    <span
      className={`inline-block max-w-full rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums ${
        tone === "dark"
          ? "border-white/20 bg-white/10 text-[#D6DFD2]"
          : "border-[#60756E]/15 bg-[#F3F6F5] text-[#526A62]"
      } ${className}`}
    >
      Jours de course cette saison · {seasonRaceDays}
    </span>
  );
}
