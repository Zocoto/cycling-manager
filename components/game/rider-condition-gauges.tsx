type RiderConditionGaugesProps = {
  form: number;
  fatigue: number;
  dayNumber: number | null;
};

export function RiderConditionGauges({
  form,
  fatigue,
  dayNumber,
}: RiderConditionGaugesProps) {
  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            État du coureur
          </p>
          <h2 className="mt-2 text-lg font-black text-[#183F37]">
            Forme et fatigue
          </h2>
        </div>
        {dayNumber ? (
          <span className="rounded-full bg-[#EAF5F3] px-3 py-1 text-xs font-black text-[#176951]">
            J{dayNumber}
          </span>
        ) : null}
      </div>

      <div className="mt-5 space-y-5">
        <Gauge
          label="Forme"
          value={form}
          colorClass="bg-[#2FA982]"
          trackClass="bg-[#D7EEE8]"
        />
        <Gauge
          label="Fatigue"
          value={fatigue}
          colorClass="bg-[#D8835A]"
          trackClass="bg-[#F5E3DA]"
        />
      </div>
    </section>
  );
}

function Gauge({
  label,
  value,
  colorClass,
  trackClass,
}: {
  label: string;
  value: number;
  colorClass: string;
  trackClass: string;
}) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-sm font-extrabold text-[#48665F]">{label}</span>
        <span className="text-lg font-black text-[#183F37]">{normalizedValue}%</span>
      </div>
      <div
        className={`mt-2 h-3 overflow-hidden rounded-full ${trackClass}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedValue}
      >
        <div
          className={`h-full rounded-full transition-[width] ${colorClass}`}
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  );
}
