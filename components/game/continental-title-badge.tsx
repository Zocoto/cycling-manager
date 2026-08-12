import {
  CONTINENTAL_CHAMPION_PALETTES,
  type ContinentalChampionshipCode,
} from "@/lib/rider-jersey";

export function ContinentalMark({
  continentCode,
  className = "mr-1 h-3 w-5",
}: {
  continentCode: ContinentalChampionshipCode;
  className?: string;
}) {
  const palette = CONTINENTAL_CHAMPION_PALETTES[continentCode];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex overflow-hidden rounded-sm border border-white/30 ${className}`}
    >
      {[palette.primary, palette.secondary, palette.accent].map(
        (color, index) => (
          <span
            key={`${color}-${index}`}
            className="min-w-0 flex-1"
            style={{ backgroundColor: color }}
          />
        ),
      )}
    </span>
  );
}

export function ContinentalTitleBadge({
  continentCode,
  continentName,
  discipline,
}: {
  continentCode: ContinentalChampionshipCode;
  continentName: string;
  discipline: "road" | "time_trial";
}) {
  const palette = CONTINENTAL_CHAMPION_PALETTES[continentCode];
  const title = `Champion ${continentName} ${
    discipline === "time_trial" ? "du contre-la-montre" : "sur route"
  }`;

  return (
    <span
      className="relative inline-flex h-7 w-10 overflow-hidden rounded-md border border-[#315B3E]/20 shadow-sm"
      title={title}
      aria-label={title}
      style={{
        background: `linear-gradient(135deg, ${palette.primary} 0 34%, ${palette.secondary} 34% 68%, ${palette.accent} 68%)`,
      }}
    >
      {discipline === "time_trial" ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-black/10"
        >
          <span className="relative h-4 w-4 rounded-full border-2 border-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            <span className="absolute left-1/2 top-[2px] h-[5px] w-[2px] -translate-x-1/2 bg-white" />
            <span className="absolute left-1/2 top-1/2 h-[2px] w-[5px] -translate-y-1/2 bg-white" />
          </span>
        </span>
      ) : null}
    </span>
  );
}
