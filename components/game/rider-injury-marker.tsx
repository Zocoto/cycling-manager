export function RiderInjuryMarker({ injuryLabel }: { injuryLabel: string }) {
  return (
    <span
      data-rider-injury-marker="true"
      title={`Blessé : ${injuryLabel}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#D6414C]/25 bg-[#FFF0F1] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#C42F3A]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-3.5 w-3.5"
      >
        <path
          fill="currentColor"
          d="M7.5 1.75h5v5.75h5.75v5H12.5v5.75h-5V12.5H1.75v-5H7.5V1.75Z"
        />
      </svg>
      <span>
        Blessé<span className="sr-only"> : {injuryLabel}</span>
      </span>
    </span>
  );
}
