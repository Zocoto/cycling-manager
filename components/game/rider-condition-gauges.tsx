type RiderFormEvent = {
  label: string;
  delta: number;
  occurredAt: string;
};

type RiderConditionGaugesProps = {
  form: number;
  dayNumber: number | null;
  events: RiderFormEvent[];
};

export function RiderConditionGauges({
  form,
  dayNumber,
  events,
}: RiderConditionGaugesProps) {
  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            État du coureur
          </p>
          <h2 className="mt-2 text-lg font-black text-[#183F37]">
            Forme du coureur
          </h2>
        </div>
        {dayNumber ? (
          <span className="rounded-full bg-[#EAF5F3] px-3 py-1 text-xs font-black text-[#176951]">
            J{dayNumber}
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        <Gauge
          label="Forme"
          value={form}
          colorClass="bg-[#2FA982]"
          trackClass="bg-[#D7EEE8]"
          events={events}
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
  events,
}: {
  label: string;
  value: number;
  colorClass: string;
  trackClass: string;
  events: RiderFormEvent[];
}) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  const totalDelta = events.reduce((total, event) => total + event.delta, 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-extrabold text-[#48665F]">
          {label}
          <span className="group/form-tooltip relative inline-flex">
            <button
              type="button"
              className="grid size-5 place-items-center rounded-full border border-[#176951]/25 bg-[#EAF5F3] text-[11px] font-black text-[#176951] outline-none focus-visible:ring-2 focus-visible:ring-[#2FA982]"
              aria-label="Détail des variations de forme sur 48 heures"
              aria-describedby="form-history-tooltip"
            >
              ?
            </button>
            <span
              id="form-history-tooltip"
              role="tooltip"
              className="invisible absolute bottom-full left-0 z-30 mb-2 w-[min(19rem,calc(100vw-3rem))] translate-y-1 rounded-xl bg-[#0B302B] p-3 text-left text-white opacity-0 shadow-xl transition group-hover/form-tooltip:visible group-hover/form-tooltip:translate-y-0 group-hover/form-tooltip:opacity-100 group-focus-within/form-tooltip:visible group-focus-within/form-tooltip:translate-y-0 group-focus-within/form-tooltip:opacity-100"
            >
              <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-[#9EDCCB]">
                Variations sur 48 h
              </span>
              {events.length > 0 ? (
                <span className="mt-2 block space-y-2">
                  {events.map((event, index) => (
                    <span
                      className="grid grid-cols-[1fr_auto] gap-3 text-xs leading-4"
                      key={`${event.occurredAt}-${event.label}-${index}`}
                    >
                      <span>
                        <span className="block font-bold">{event.label}</span>
                        <span className="text-[10px] text-white/60">
                          {formatFormEventDate(event.occurredAt)}
                        </span>
                      </span>
                      <span
                        className={
                          event.delta >= 0
                            ? "font-black text-[#9EDCCB]"
                            : "font-black text-[#FF9D9D]"
                        }
                      >
                        {formatSignedForm(event.delta)}
                      </span>
                    </span>
                  ))}
                  <span className="grid grid-cols-[1fr_auto] gap-3 border-t border-white/15 pt-2 text-xs font-black">
                    <span>Total sur 48 h</span>
                    <span>{formatSignedForm(totalDelta)}</span>
                  </span>
                </span>
              ) : (
                <span className="mt-2 block text-xs font-semibold leading-5 text-white/70">
                  Aucune variation enregistrée sur les 48 dernières heures.
                </span>
              )}
            </span>
          </span>
        </span>
        <span className="text-lg font-black text-[#183F37]">
          {formatFormValue(normalizedValue)}%
        </span>
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

function formatFormValue(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function formatSignedForm(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })}`;
}

function formatFormEventDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}
