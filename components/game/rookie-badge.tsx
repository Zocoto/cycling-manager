export function RookieBadge({
  inverse = false,
  className = "",
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span
      title="Nouveau Directeur Sportif · badge visible pendant 3 semaines"
      aria-label="Rookie, nouveau Directeur Sportif"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.09em] ${
        inverse
          ? "border-[#F7DA73]/45 bg-[#F2C94C]/15 text-[#F7DA73]"
          : "border-[#D9AC12]/30 bg-[#FFF4BF] text-[#705600]"
      } ${className}`}
    >
      <span aria-hidden="true">★</span>
      Rookie
    </span>
  );
}
