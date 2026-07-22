import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import {
  formatScoutedNumericValue,
  formatScoutedPotentialValue,
  type ScoutedNumericValue,
  type TransferScoutingReport,
} from "@/lib/game/transfer-scouting";

type TransferScoutingReportProps = {
  report: TransferScoutingReport;
  compact?: boolean;
};

export function TransferScoutingReportPanel({
  report,
  compact = false,
}: TransferScoutingReportProps) {
  const isComplete = RIDER_RATING_AXES.every(
    (axis) => report.ratings[axis.key].kind === "exact"
  );

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-[#315B3E]/10 bg-[#F7FAF8] p-3"
          : "rounded-2xl border border-[#315B3E]/12 bg-[#F7FAF8] p-5 sm:p-6"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            Rapport de scouting
          </p>
          <p className="mt-1 text-xs font-bold text-[#60756E]">
            {isComplete ? "Données de votre équipe" : "Analyse standard partielle"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScoutingSummaryBadge
            label="Niveau"
            value={formatScoutedNumericValue(report.overall)}
          />
          <ScoutingSummaryBadge
            label="Potentiel"
            value={formatScoutedPotentialValue(report.potential)}
            accent
          />
        </div>
      </div>

      <div
        className={`mt-4 grid gap-2 ${
          compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7"
        }`}
      >
        {RIDER_RATING_AXES.map((axis) => (
          <ScoutingRating
            key={axis.key}
            label={axis.shortLabel}
            value={report.ratings[axis.key]}
          />
        ))}
      </div>

      {!isComplete ? (
        <p className="mt-3 text-[10px] font-semibold leading-4 text-[#71837D]">
          Une valeur exacte, une estimation ou un ? selon la qualité des informations disponibles. Des outils de scouting permettront d’affiner ce rapport.
        </p>
      ) : null}
    </section>
  );
}

function ScoutingSummaryBadge({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className={
        accent
          ? "rounded-full bg-[#FFF0B8] px-3 py-1.5 text-[10px] font-black text-[#705B00]"
          : "rounded-full bg-[#DDF3E7] px-3 py-1.5 text-[10px] font-black text-[#176951]"
      }
    >
      {label} {value}
    </span>
  );
}

function ScoutingRating({
  label,
  value,
}: {
  label: string;
  value: ScoutedNumericValue;
}) {
  const valueClass =
    value.kind === "exact"
      ? "text-[#176951]"
      : value.kind === "range"
        ? "text-[#256390]"
        : "text-[#8A6B16]";

  return (
    <span className="rounded-xl border border-[#315B3E]/10 bg-white px-2 py-2 text-center shadow-sm">
      <span className="block text-[9px] font-black uppercase tracking-wider text-[#60756E]">
        {label}
      </span>
      <span className={`mt-0.5 block text-xs font-black ${valueClass}`}>
        {formatScoutedNumericValue(value)}
      </span>
    </span>
  );
}
