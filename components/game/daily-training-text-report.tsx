import Link from "@/components/ui/app-link";
import {
  formatDailyTrainingRiderSentence,
  formatTrainingChange,
  type DailyTrainingReport,
} from "@/lib/game/daily-training-report";

export function DailyTrainingTextReport({
  report,
  baseHref,
  sectionHref,
  sectionLabel,
}: {
  report: DailyTrainingReport;
  baseHref: string;
  sectionHref: string;
  sectionLabel: string;
}) {
  const isSenior = report.audience === "senior";
  const previousDay = report.dayNumber > 1 ? report.dayNumber - 1 : null;
  const nextDay =
    report.dayNumber < report.currentDayNumber ? report.dayNumber + 1 : null;

  return (
    <div className="mt-6">
      <header className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-7 text-white shadow-[0_22px_60px_rgba(7,26,23,0.2)] sm:px-9 sm:py-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC] sm:text-xs">
              {report.teamName} · {report.seasonName}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Rapport quotidien {isSenior ? "senior" : "junior"}
            </h1>
            <p className="mt-3 text-sm font-bold text-[#D6DFD2]">
              J{report.dayNumber} · {formatReportDate(report.calendarDate)}
            </p>
          </div>
          <Link
            href={sectionHref}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black transition hover:bg-white/20"
          >
            Retour · {sectionLabel}
          </Link>
        </div>
      </header>

      <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#315B3E]/12 bg-[#FFFEFA] shadow-[0_16px_45px_rgba(19,60,46,0.09)]">
        <header className="border-b border-[#315B3E]/12 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                Feuille de séance · J{report.dayNumber}
              </p>
              <h2 className="mt-1 text-xl font-black text-[#183F37] sm:text-2xl">
                Tous les {isSenior ? "coureurs" : "jeunes"}, ligne par ligne
              </h2>
            </div>
            <DayNavigation
              baseHref={baseHref}
              previousDay={previousDay}
              nextDay={nextDay}
            />
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-[#EAF5F3] p-2 sm:max-w-2xl sm:gap-3">
            <ReportMetric label="Séances" value={String(report.sessionCount)} />
            <ReportMetric
              label="Avec gain"
              value={String(report.progressedRiderCount)}
            />
            <ReportMetric
              label="Gain cumulé"
              value={`+${formatTrainingChange(report.totalPositiveChange)}`}
            />
          </dl>
        </header>

        {report.riders.length ? (
          <ol className="divide-y divide-[#315B3E]/10 px-4 py-2 sm:px-7">
            {report.riders.map((rider, index) => (
              <li
                key={rider.riderId}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 py-3.5 sm:grid-cols-[2.5rem_minmax(180px,0.32fr)_minmax(0,1fr)] sm:items-baseline sm:gap-4"
              >
                <span className="text-[10px] font-black tabular-nums text-[#86A098]">
                  {String(index + 1).padStart(2, "0")}.
                </span>
                <strong className="text-sm font-black text-[#183F37]">
                  {rider.firstName} {rider.lastName}
                </strong>
                <p className="col-start-2 text-xs font-semibold leading-5 text-[#60756E] sm:col-start-3 sm:text-[13px]">
                  {formatDailyTrainingRiderSentence(rider)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-6 py-12 text-center text-sm font-semibold text-[#60756E]">
            Aucun {isSenior ? "coureur" : "junior"} à répertorier pour cette
            journée.
          </p>
        )}

        <footer className="border-t border-[#315B3E]/10 bg-[#F8FBF9] px-5 py-3 text-[10px] font-bold leading-5 text-[#71877F] sm:px-7">
          Ce relevé lit uniquement les séances déjà enregistrées. Il ne relance
          aucun calcul d’entraînement et n’ajoute aucune charge au bureau du DS.
        </footer>
      </section>
    </div>
  );
}

function DayNavigation({
  baseHref,
  previousDay,
  nextDay,
}: {
  baseHref: string;
  previousDay: number | null;
  nextDay: number | null;
}) {
  return (
    <nav aria-label="Changer la journée du rapport" className="flex gap-2">
      {previousDay ? (
        <Link
          href={`${baseHref}?jour=${previousDay}`}
          className="rounded-xl border border-[#315B3E]/15 bg-white px-3 py-2 text-[10px] font-black text-[#176951] transition hover:bg-[#EAF5F3]"
        >
          ← J{previousDay}
        </Link>
      ) : (
        <span className="rounded-xl border border-[#315B3E]/8 px-3 py-2 text-[10px] font-black text-[#A4B4AE]">
          ← Début
        </span>
      )}
      {nextDay ? (
        <Link
          href={`${baseHref}?jour=${nextDay}`}
          className="rounded-xl border border-[#315B3E]/15 bg-white px-3 py-2 text-[10px] font-black text-[#176951] transition hover:bg-[#EAF5F3]"
        >
          J{nextDay} →
        </Link>
      ) : (
        <span className="rounded-xl border border-[#315B3E]/8 px-3 py-2 text-[10px] font-black text-[#A4B4AE]">
          Aujourd’hui
        </span>
      )}
    </nav>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-2 py-3 text-center sm:px-4">
      <dt className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#71877F] sm:text-[9px]">
        {label}
      </dt>
      <dd className="mt-1 truncate text-lg font-black tabular-nums text-[#176951] sm:text-xl">
        {value}
      </dd>
    </div>
  );
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}
