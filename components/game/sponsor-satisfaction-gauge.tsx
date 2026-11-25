type SponsorSatisfactionGaugeProps = {
  score: number;
  variant?: "default" | "dashboard";
};

export function SponsorSatisfactionGauge({
  score,
  variant = "default",
}: SponsorSatisfactionGaugeProps) {
  const normalizedScore = Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 0;
  const isDashboard = variant === "dashboard";
  const hue = Math.round(normalizedScore <= 50
    ? normalizedScore * 0.8
    : 40 + (normalizedScore - 50) * 2);
  const color = `hsl(${hue} 65% ${isDashboard ? 62 : 32}%)`;
  const scoreColor = isDashboard ? color : `hsl(${hue} 65% 28%)`;

  return (
    <div
      className={isDashboard
        ? "relative z-10 mt-4 rounded-xl border border-white/15 bg-black/20 px-3 py-2.5"
        : "min-w-52 rounded-xl border border-[#DCE6E1] bg-white/90 px-4 py-3"}
      data-sponsor-satisfaction
    >
      <div className="flex items-end justify-between gap-4">
        <p className={`text-[10px] font-extrabold uppercase tracking-[0.14em] ${isDashboard ? "text-white/75" : "text-[#60756E]"}`}>
          Satisfaction sponsor
        </p>
        <p className={`${isDashboard ? "text-lg" : "text-xl"} shrink-0 font-black tabular-nums`} style={{ color: scoreColor }}>
          {normalizedScore}<span className="text-xs">/100</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Satisfaction sponsor"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedScore}
        aria-valuetext={`${normalizedScore} / 100`}
        className={`mt-2 h-2 overflow-hidden rounded-full ${isDashboard ? "bg-white/15" : "bg-[#E4ECE8]"}`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${normalizedScore}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
