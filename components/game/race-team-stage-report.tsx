import Link from "@/components/ui/app-link";
import type { TeamStageReport } from "@/lib/game/race-team-stage-report";

const distance = (km: number) => new Intl.NumberFormat("fr", { maximumFractionDigits: 1 }).format(km);
const gap = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
};
const STATUS_LABELS = {
  finished: "Arrivée", did_not_start: "Non-partant", did_not_finish: "Abandon",
  disqualified: "Disqualifié", outside_time_limit: "Hors délai", withdrawn: "Retiré",
};

export function RaceTeamStageReport({ report }: { report: TeamStageReport | null }) {
  if (!report) return null;
  const best = [...report.riders].filter((rider) => rider.result.rank !== null)
    .sort((a, b) => a.result.rank! - b.result.rank!)[0];
  const finished = report.riders.filter((rider) => rider.result.status === "finished").length;
  return (
    <section aria-label="Bilan de votre équipe sur l’étape" className="min-w-0 border-b border-[#315B3E]/12 bg-[#F3F8F5] px-4 py-5 sm:px-8 sm:py-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#176951]">Le débrief du directeur sportif</p>
      <h3 className="mt-1 text-xl font-black text-[#0B302B]">Votre équipe sur l’étape</h3>
      <p className="mt-1 break-words text-sm font-semibold text-[#60756E]">{report.teamName} · {finished} / {report.riders.length} coureurs à l’arrivée</p>
      {best ? <p className="mt-3 rounded-xl border border-[#176951]/15 bg-white px-4 py-3 text-sm font-bold text-[#0B302B]">
        Meilleur résultat : <Link href={`/jeu/coureurs/${best.result.riderId}`} className="text-[#176951] underline decoration-[#176951]/30 underline-offset-4">{best.result.riderName}</Link>
        {" · "}{best.result.rank === 1 ? "Victoire" : `${best.result.rank}e`}
        {best.result.gapToWinnerMs ? ` · +${gap(best.result.gapToWinnerMs)}` : ""}
      </p> : null}

      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        {report.riders.map((rider) => {
          const work = rider.workKm;
          const metrics = [
            rider.breakawayKm && `Échappée : ${distance(rider.breakawayKm)} km`,
            rider.relayKm && `Relais dans l’échappée : ${distance(rider.relayKm)} km`,
            work?.protection && `Protection : ${distance(work.protection)} km`,
            work?.recovery && `Aide au retour : ${distance(work.recovery)} km`,
            work?.peloton && `En tête du peloton : ${distance(work.peloton)} km`,
            work?.leadout && `Lancement du sprint : ${distance(work.leadout)} km`,
          ].filter(Boolean);
          return <article key={rider.result.riderId} className="min-w-0 rounded-xl border border-[#315B3E]/12 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/jeu/coureurs/${rider.result.riderId}`} className="break-words text-sm font-black text-[#176951] hover:underline">{rider.result.riderName}</Link>
                {rider.role ? <p className="mt-1 text-xs font-semibold text-[#60756E]">Rôle au départ : {rider.role}</p> : null}
              </div>
              <span className="rounded-lg bg-[#EAF5F3] px-2 py-1 text-xs font-black text-[#0B302B]">{rider.result.rank !== null ? `${rider.result.rank}e` : STATUS_LABELS[rider.result.status]}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-[#60756E]">
              {rider.result.status === "finished" ? `${rider.result.gapToWinnerMs ? `+${gap(rider.result.gapToWinnerMs)}` : "Dans le temps du vainqueur"}` : rider.result.abandonmentReason ?? STATUS_LABELS[rider.result.status]}
              {rider.energyAfter !== null ? ` · Réserve à l’arrivée : ${Math.round(rider.energyAfter)} %` : ""}
            </p>
            {metrics.length ? <ul className="mt-2 space-y-1 text-xs font-semibold text-[#315B3E]">{metrics.map((metric) => <li key={String(metric)}>{metric}</li>)}</ul> : null}
            {report.events.some((event) => event.riderIds.includes(rider.result.riderId)) ? <details className="mt-3 border-t border-[#315B3E]/10 pt-2">
              <summary className="cursor-pointer py-1 text-xs font-black text-[#176951]">Voir ses faits de course</summary>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-[#315B3E]">{report.events.filter((event) => event.riderIds.includes(rider.result.riderId)).map((event) => <li key={event.id} className="[overflow-wrap:anywhere]"><strong>Km {distance(event.distanceKm)}{event.endKm !== undefined ? `–${distance(event.endKm)}` : ""} · {event.title}</strong><br />{event.detail}</li>)}</ul>
            </details> : null}
          </article>;
        })}
      </div>
      {report.tactics.length ? <div className="mt-4 rounded-xl border border-[#315B3E]/12 bg-white p-4"><h4 className="text-sm font-black text-[#0B302B]">Bilan du briefing tactique</h4>{report.tactics.map((text, index) => <p key={index} className="mt-2 text-xs leading-5 text-[#315B3E]">{text}</p>)}</div> : null}
      <details className="mt-4 rounded-xl border border-[#315B3E]/15 bg-white p-3 sm:p-4">
        <summary className="cursor-pointer text-sm font-black text-[#0B302B]">Chronologie de l’équipe · {report.events.length} faits enregistrés</summary>
        {report.events.length ? <ol className="mt-4 space-y-3">{report.events.map((event) => <li key={event.id} className="min-w-0 border-l-2 border-[#72D4B7] pl-3 text-xs leading-5 [overflow-wrap:anywhere]">
          <p className="font-black text-[#176951]">Km {distance(event.distanceKm)}{event.endKm !== undefined ? `–${distance(event.endKm)}` : ""} · {event.title}</p>
          <p className="text-[#315B3E]">{event.detail}</p>
        </li>)}</ol> : <p className="mt-3 text-xs text-[#60756E]">Aucun fait détaillé disponible pour cette étape.</p>}
      </details>
      <p className="mt-3 text-[11px] leading-5 text-[#60756E]">{report.hasTimeline ? "Les changements de groupe sont repérés aux points enregistrés du parcours ; les distances sont estimées entre ces observations." : "Le scénario détaillé de cette étape n’est pas disponible. Le bilan présente les résultats officiels."}
        {!report.hasWorkRecording ? " Le détail des distances de protection, de poursuite et de lancement n’a pas été enregistré sur cette étape." : " Les actions de soutien proviennent du travail enregistré pendant la simulation."}
      </p>
    </section>
  );
}
