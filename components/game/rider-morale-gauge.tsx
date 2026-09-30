import {
  getRiderMoraleLabel,
  normalizeRiderMorale,
  type RiderMoraleEvent,
} from "@/lib/game/rider-morale";

export function RiderMoraleGauge({
  value,
  events = [],
  compact = false,
}: {
  value: number;
  events?: readonly RiderMoraleEvent[];
  compact?: boolean;
}) {
  const morale = normalizeRiderMorale(value);
  const rounded = Math.round(morale);
  const label = getRiderMoraleLabel(morale);
  const history = events.slice(0, 8);
  const title = [
    `Moral actuel : ${rounded} % · ${label}`,
    history.length > 0 ? "Éléments ayant influencé le moral :" : "Aucune variation enregistrée.",
    ...history.map(
      (event) =>
        `${formatSigned(event.delta)} · ${event.label} (${formatDate(event.occurredAt)})`,
    ),
  ].join("\n");

  return (
    <div
      title={title}
      className={compact ? "mx-auto w-20" : "w-full"}
      data-rider-morale-gauge
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#3D6DAE]">
          Moral
        </span>
        <span className="text-[11px] font-black tabular-nums text-[#183F37]">
          {rounded}%
        </span>
      </div>
      <span
        role="progressbar"
        aria-label={`Moral actuel : ${rounded} %, ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[#DCEBFA]"
      >
        <span
          className="block h-full rounded-full bg-[#3B82F6] transition-[width]"
          style={{ width: `${morale}%` }}
        />
      </span>
      {!compact ? (
        <span className="mt-1 block text-[10px] font-bold text-[#60758B]">
          {label}
        </span>
      ) : null}
    </div>
  );
}

function formatSigned(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}
