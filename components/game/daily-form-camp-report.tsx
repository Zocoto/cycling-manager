import Link from "@/components/ui/app-link";
import { formatFormCampValue, type DailyFormCampReport } from "@/lib/game/daily-form-camp-report";

const REPORT_HREF = "/jeu/centre-de-soin/rapport-stages";

export function DailyFormCampTextReport({ report }: { report: DailyFormCampReport }) {
  const previousDay = report.dayNumber > 1 ? report.dayNumber - 1 : null;
  const nextDay = report.dayNumber < report.currentDayNumber - 1 ? report.dayNumber + 1 : null;
  const date = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris",
  }).format(new Date(`${report.calendarDate}T12:00:00Z`));

  return (
    <div className="mt-6">
      <header className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-7 text-white shadow-[0_22px_60px_rgba(7,26,23,0.2)] sm:px-9 sm:py-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC] sm:text-xs">
              {report.teamName} · {report.seasonName}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Rapport des stages de forme</h1>
            <p className="mt-3 text-sm font-bold text-[#D6DFD2]">J{report.dayNumber} · {date}</p>
          </div>
          <Link href="/jeu/centre-de-soin?onglet=forme" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black transition hover:bg-white/20">
            Retour · Forme et stages
          </Link>
        </div>
      </header>

      <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#315B3E]/12 bg-[#FFFEFA] shadow-[0_16px_45px_rgba(19,60,46,0.09)]">
        <header className="border-b border-[#315B3E]/12 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#183F37] sm:text-2xl">Bilan quotidien, coureur par coureur</h2>
              <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-[#60756E]">
                Les gains de la journée de stage sont appliqués au passage à la journée suivante. Ce bilan présente les gains réellement reçus, dans la limite de 100 % de forme.
              </p>
            </div>
            <nav aria-label="Changer la journée du rapport" className="flex gap-2">
              {previousDay ? <DayLink day={previousDay} previous /> : null}
              {nextDay ? <DayLink day={nextDay} /> : null}
            </nav>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#EAF5F3] p-2 sm:max-w-md sm:gap-3">
            <ReportMetric label="Coureurs en stage" value={String(report.riderCount)} />
            <ReportMetric label="Gain total de forme" value={`+${formatFormCampValue(report.totalFormGain)} pts`} />
          </dl>
        </header>

        {report.riders.length ? (
          <ol className="divide-y divide-[#315B3E]/10 px-4 py-2 sm:px-7">
            {report.riders.map((rider, index) => (
              <li key={rider.riderId} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 py-4 sm:grid-cols-[2rem_minmax(180px,1fr)_auto] sm:items-center sm:gap-4">
                <span className="text-[10px] font-black tabular-nums text-[#86A098]">{String(index + 1).padStart(2, "0")}.</span>
                <div>
                  <Link href={`/jeu/coureurs/${rider.riderId}`} className="text-sm font-black text-[#183F37] underline decoration-[#315B3E]/20 underline-offset-4 hover:text-[#176951]">
                    {rider.firstName} {rider.lastName}
                  </Link>
                  <p className="mt-1 text-xs font-semibold text-[#60756E]">
                    {rider.campType === "premium" ? "Stage premium" : "Stage classique"} · J{rider.startDayNumber}–J{rider.endDayNumber}
                  </p>
                </div>
                <div className="col-start-2 text-xs font-semibold leading-5 text-[#60756E] sm:col-start-auto sm:text-right">
                  <p>Forme : {formatFormCampValue(rider.formBefore)} % → {formatFormCampValue(rider.formAfter)} %</p>
                  <p className="font-black text-[#176951]">+{formatFormCampValue(rider.formDelta)} {rider.formDelta === 1 ? "point de forme" : "points de forme"}</p>
                  {rider.formAfter === 100 ? <p className="text-[10px]">Plafond de forme atteint</p> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-6 py-12 text-center text-sm font-semibold text-[#60756E]">
            {report.currentDayNumber === 1
              ? "Le premier bilan sera disponible après le passage à la journée suivante."
              : "Aucun stage de forme enregistré pour cette journée."}
          </p>
        )}
      </section>
    </div>
  );
}

function DayLink({ day, previous = false }: { day: number; previous?: boolean }) {
  return <Link href={`${REPORT_HREF}?jour=${day}`} className="rounded-xl border border-[#315B3E]/15 bg-white px-3 py-2 text-[10px] font-black text-[#176951] transition hover:bg-[#EAF5F3]">
    {previous ? `← J${day}` : `J${day} →`}
  </Link>;
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-white px-2 py-3 text-center sm:px-4">
    <dt className="text-[8px] font-black uppercase tracking-[0.1em] text-[#71877F] sm:text-[9px]">{label}</dt>
    <dd className="mt-1 text-lg font-black tabular-nums text-[#176951] sm:text-xl">{value}</dd>
  </div>;
}
