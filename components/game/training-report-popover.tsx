"use client";

import { useId, useState } from "react";

import { TRAINER_SPECIALTY_LABELS } from "@/lib/game/staff";
import {
  formatTrainingProgressMilli,
  LOW_FORM_REST_GAIN,
  TRAINING_DOMAIN_LABELS,
  type RiderTrainingReport,
  type RiderTrainingSeasonReport,
  type TrainingSessionStatus,
} from "@/lib/game/training";

const STAT_LABELS: Record<string, string> = {
  mountain: "MO",
  hills: "HIL",
  flat: "FL",
  time_trial: "TT",
  cobbles: "COB",
  sprint: "SP",
  acceleration: "ACC",
  downhill: "DH",
  endurance: "STA",
  resistance: "RES",
  recovery: "REC",
  breakaway: "FTR",
  prologue: "PRL",
};

const STATUS_LABELS: Record<TrainingSessionStatus, string> = {
  completed: "Séance réalisée",
  skipped_low_form: "Pas d’entraînement",
  skipped_injury: "Pas d’entraînement",
  skipped_form_camp: "Pas d’entraînement",
  skipped_reconnaissance: "Pas d’entraînement",
};

const SKIPPED_REASON_LABELS: Partial<Record<TrainingSessionStatus, string>> = {
  skipped_low_form: "Forme inférieure au seuil fixé par l’équipe",
  skipped_injury: "Coureur indisponible en raison d’une blessure",
  skipped_form_camp: "Coureur indisponible pendant son stage de forme",
  skipped_reconnaissance:
    "Coureur indisponible pendant son stage de reconnaissance",
};

type ReportView = "latest" | "season";

export function TrainingReportPopover({
  report,
  seasonReport,
  tutorialTargetId,
}: {
  report: RiderTrainingReport | null;
  seasonReport: RiderTrainingSeasonReport | null;
  tutorialTargetId?: string;
}) {
  const [activeView, setActiveView] = useState<ReportView>("latest");
  const rawId = useId();
  const panelId = `training-report-${rawId.replace(/:/g, "")}`;

  if (!report || !seasonReport) {
    return (
      <span
        data-tutorial-id={tutorialTargetId}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dashed border-[#315B3E]/20 px-3 text-center text-xs font-black text-[#7B8D87]"
      >
        Aucun rapport
      </span>
    );
  }

  return (
    <details data-tutorial-id={tutorialTargetId} className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col items-center justify-center rounded-xl border border-[#176951]/20 bg-[#EAF5F3] px-3 text-center text-xs font-black text-[#176951] transition hover:bg-[#DDF1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]">
        <span>Rapports</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-[0.11em] text-[#60756E]">
          J{report.dayNumber} · Saison
        </span>
      </summary>

      <div className="invisible absolute right-0 z-30 mt-2 max-h-[min(75vh,680px)] w-[min(440px,calc(100vw-2.5rem))] translate-y-1 overflow-y-auto overscroll-contain rounded-2xl border border-[#315B3E]/15 bg-[#071A17] p-5 text-white opacity-0 shadow-2xl transition group-open:visible group-open:translate-y-0 group-open:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 border-b border-white/10 bg-[#071A17] px-5 pb-4 pt-5">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-white/7 p-1"
            aria-label="Période du rapport"
          >
            <ReportViewButton
              active={activeView === "latest"}
              controls={`${panelId}-latest`}
              onClick={() => setActiveView("latest")}
            >
              Dernière séance
            </ReportViewButton>
            <ReportViewButton
              active={activeView === "season"}
              controls={`${panelId}-season`}
              onClick={() => setActiveView("season")}
            >
              Saison
            </ReportViewButton>
          </div>
        </div>

        <div id={`${panelId}-latest`} hidden={activeView !== "latest"}>
          <LatestTrainingReport report={report} />
        </div>
        <div id={`${panelId}-season`} hidden={activeView !== "season"}>
          <SeasonTrainingReport report={seasonReport} />
        </div>
      </div>
    </details>
  );
}

function ReportViewButton({
  active,
  controls,
  onClick,
  children,
}: {
  active: boolean;
  controls: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-controls={controls}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BE0BC] ${
        active
          ? "bg-[#EAF5F3] text-[#176951] shadow-sm"
          : "text-[#BFD1C6] hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function LatestTrainingReport({ report }: { report: RiderTrainingReport }) {
  const isCompleted = report.status === "completed";
  const isLowFormRest = report.status === "skipped_low_form";
  const displaysFormChange = isCompleted || isLowFormRest;
  const ratingChanges = sortStatEntries(report.ratingChanges).filter(
    ([, value]) => value !== 0,
  );
  const trainingProgress = sortStatEntries(report.progressMilli).filter(
    ([, value]) => value > 0,
  );
  const declineProgress = sortStatEntries(report.declineMilli).filter(
    ([, value]) => value > 0,
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
            {STATUS_LABELS[report.status]} · J{report.dayNumber}
          </p>
          <p className="mt-1 font-black">
            {isCompleted
              ? `${TRAINING_DOMAIN_LABELS[report.domain]} · ${report.intensity}%`
              : SKIPPED_REASON_LABELS[report.status]}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
            report.formDelta < 0
              ? "bg-[#B54242]/25 text-[#FFB8B8]"
              : "bg-[#278B70]/25 text-[#9BE0BC]"
          }`}
        >
          {displaysFormChange ? (
            <>
              Forme {report.formDelta > 0 ? "+" : ""}
              {report.formDelta}
            </>
          ) : (
            "Aucun gain"
          )}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
        <ReportValue label="Avant" value={`${report.formBefore}%`} />
        <ReportValue label="Après" value={`${report.formAfter}%`} />
        <ReportValue
          label="Entraîneur"
          value={
            report.trainerSpecialty
              ? `${TRAINER_SPECIALTY_LABELS[report.trainerSpecialty]} · N${report.trainerLevel}`
              : "Aucun"
          }
        />
        <ReportValue
          label="Kiné"
          value={
            report.physiotherapistLevel > 0
              ? `N${report.physiotherapistLevel}`
              : "Aucun"
          }
        />
        {report.trainerCountryMatch ? (
          <ReportValue label="Affinité nationale" value="Active · +5%" />
        ) : null}
      </dl>

      {isCompleted ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
            Gains de la dernière séance
          </p>
          {trainingProgress.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
              {trainingProgress.map(([stat, value]) => (
                <li
                  key={stat}
                  className="flex items-center justify-between rounded-lg bg-white/7 px-3 py-2"
                >
                  <span className="text-[#D6DFD2]">
                    {STAT_LABELS[stat] ?? stat}
                  </span>
                  <span className="text-[#9BE0BC]">
                    +{formatTrainingProgressMilli(value)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs font-bold leading-5 text-[#D6DFD2]">
              Aucun gain de statistique pour cette séance.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-4 py-3">
          <p className="text-xs font-black text-[#FFF4C5]">
            {isLowFormRest ? "Repos automatique" : "Pas d’entraînement"}
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-[#D6DFD2]">
            {isLowFormRest
              ? `Aucun gain de statistique, mais ${LOW_FORM_REST_GAIN} points de forme récupérés.`
              : "Aucun gain d’entraînement n’a été crédité pendant la séance de 8 h."}
          </p>
        </div>
      )}

      {declineProgress.length > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#EAB0A0]">
            Déclin naturel appliqué
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-[#D6DFD2]">
            {declineProgress
              .map(
                ([stat, value]) =>
                  `${STAT_LABELS[stat] ?? stat} −${formatTrainingProgressMilli(value)}`,
              )
              .join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
          Notes entières mises à jour
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-[#D6DFD2]">
          {ratingChanges.length > 0
            ? ratingChanges
                .map(
                  ([stat, value]) =>
                    `${STAT_LABELS[stat] ?? stat} ${value > 0 ? "+" : ""}${value}`,
                )
                .join(" · ")
            : "Aucune note entière n’a changé : les décimales sont conservées pour les prochaines séances."}
        </p>
      </div>
    </>
  );
}

function SeasonTrainingReport({
  report,
}: {
  report: RiderTrainingSeasonReport;
}) {
  const totalRatingGain = report.stats.reduce(
    (total, stat) => total + stat.ratingGain,
    0,
  );
  const totalRatingLoss = report.stats.reduce(
    (total, stat) => total + stat.ratingLoss,
    0,
  );

  return (
    <>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
          Bilan J{report.fromDayNumber} → J{report.toDayNumber}
        </p>
        <h3 className="mt-1 text-lg font-black">Évolution des notes</h3>
        <p className="mt-2 text-xs font-bold leading-5 text-[#BFD1C6]">
          Les notes de départ sont comparées aux valeurs actuelles. Les
          millipoints montrent aussi le travail encore conservé entre deux
          passages de note entière.
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <SeasonSummaryValue label="Séances" value={`${report.sessionCount}`} />
        <SeasonSummaryValue
          label="Réalisées"
          value={`${report.completedSessionCount}`}
        />
        <SeasonSummaryValue
          label="Non réalisées"
          value={`${report.skippedSessionCount}`}
        />
        <SeasonSummaryValue
          label="Impact forme"
          value={formatSignedInteger(report.totalFormDelta)}
          tone={report.totalFormDelta > 0 ? "positive" : report.totalFormDelta < 0 ? "negative" : "neutral"}
        />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
        <span className="rounded-full bg-[#278B70]/25 px-3 py-1.5 text-[#9BE0BC]">
          Notes gagnées +{totalRatingGain}
        </span>
        {totalRatingLoss > 0 ? (
          <span className="rounded-full bg-[#B54242]/25 px-3 py-1.5 text-[#FFB8B8]">
            Notes perdues −{totalRatingLoss}
          </span>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {report.stats.map((stat) => (
          <li
            key={stat.statCode}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black text-[#D6DFD2]">
                {STAT_LABELS[stat.statCode]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  stat.netRatingChange > 0
                    ? "bg-[#278B70]/25 text-[#9BE0BC]"
                    : stat.netRatingChange < 0
                      ? "bg-[#B54242]/25 text-[#FFB8B8]"
                      : "bg-white/10 text-[#BFD1C6]"
                }`}
              >
                {formatSignedInteger(stat.netRatingChange)}
              </span>
            </div>
            <p className="mt-2 flex items-baseline gap-2 font-black">
              <span className="text-sm text-[#8EB9AA]">J1 {stat.initialRating}</span>
              <span className="text-[#60756E]">→</span>
              <span className="text-lg text-white">{stat.currentRating}</span>
            </p>
            <p className="mt-2 text-[10px] font-bold leading-4 text-[#BFD1C6]">
              Travail +{formatTrainingProgressMilli(stat.totalTrainingMilli)}
              {stat.totalDeclineMilli > 0
                ? ` · Déclin −${formatTrainingProgressMilli(stat.totalDeclineMilli)}`
                : ""}
            </p>
            <p className="mt-1 text-[10px] font-black text-[#8EB9AA]">
              Solde décimal {formatSignedMilli(stat.balanceMilli)}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-white/10 pt-4 text-[10px] font-bold leading-4 text-[#8EB9AA]">
        Période suivie depuis J1. Dernière séance enregistrée : J
        {report.lastSessionDayNumber}.
      </p>
    </>
  );
}

function SeasonSummaryValue({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-xl bg-white/7 px-3 py-2.5">
      <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8EB9AA]">
        {label}
      </dt>
      <dd
        className={`mt-1 font-black ${
          tone === "positive"
            ? "text-[#9BE0BC]"
            : tone === "negative"
              ? "text-[#FFB8B8]"
              : "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function sortStatEntries(values: Record<string, number>) {
  const statOrder = new Map(
    Object.keys(STAT_LABELS).map((stat, index) => [stat, index]),
  );

  return Object.entries(values).sort(
    ([left], [right]) =>
      (statOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (statOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-black uppercase tracking-wider text-[#8EB9AA]">
        {label}
      </dt>
      <dd className="mt-1 font-black text-white">{value}</dd>
    </div>
  );
}

function formatSignedInteger(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function formatSignedMilli(value: number) {
  if (value > 0) return `+${formatTrainingProgressMilli(value)}`;
  if (value < 0) return `−${formatTrainingProgressMilli(Math.abs(value))}`;
  return formatTrainingProgressMilli(0);
}
