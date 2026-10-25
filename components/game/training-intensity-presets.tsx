"use client";

const INTENSITY_PRESETS = [0, 25, 50, 75, 100] as const;

/** Local shortcuts only: choosing a preset never submits the training form. */
export function TrainingIntensityPresets({
  intensity,
  onChange,
}: {
  intensity: number;
  onChange: (intensity: number) => void;
}) {
  return (
    <div role="group" aria-label="Paliers d’intensité" className="mt-2 grid grid-cols-5 gap-1">
      {INTENSITY_PRESETS.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`Régler l’intensité à ${value} %`}
          aria-pressed={intensity === value}
          onClick={() => onChange(value)}
          className={`min-h-9 min-w-0 rounded-md border px-1 text-[10px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]/50 focus-visible:ring-offset-1 ${intensity === value
            ? "border-[#278B70]/25 bg-[#EAF5F0] text-[#176951]"
            : "border-transparent text-[#60756E] hover:border-[#315B3E]/10 hover:bg-[#F1F6F3] hover:text-[#176951]"}`}
        >
          {value} %
        </button>
      ))}
    </div>
  );
}
