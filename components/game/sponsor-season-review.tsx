import {SponsorObjectiveTitle} from "./sponsor-objective-title";
import {SponsorPartialObjectiveResult} from "./sponsor-partial-objective-result";
import {getSponsorObjectiveProgressDisplay} from "@/lib/game/sponsor-objective-progress";
import {getSponsorReviewObjectivePresentation, summarizeSponsorSeasonReview, type SponsorSeasonReview, type SponsorSeasonReviewObjective} from "@/lib/game/sponsor-season-review";

const percentage = new Intl.NumberFormat("fr-FR", {maximumFractionDigits: 2, signDisplay: "exceptZero"});
const signedMoney = (value: number, currency: string) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency, maximumFractionDigits: 0, signDisplay: "exceptZero",
}).format(value);
const money = (value: number | null, currency: string) => value === null ? "—" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency, maximumFractionDigits: 0,
}).format(value);

export function SponsorSeasonReviewPanel({report}: {report: SponsorSeasonReview | null}) {
  if (!report) return null;
  const summary = summarizeSponsorSeasonReview(report);
  return (
    <section className="mt-8 overflow-hidden rounded-[28px] border border-[#315B3E]/15 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.07)]" aria-labelledby="sponsor-season-review-title">
      <div className="border-b border-[#315B3E]/10 bg-[#EFF7F2] p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">Saison {report.gameYear} clôturée</p>
        <h2 id="sponsor-season-review-title" className="mt-2 text-2xl font-black tracking-tight text-[#183F37]">Votre bilan sponsor</h2>
        <p className="mt-1 text-sm font-semibold text-[#526A62]">{report.sponsorName}</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Metric label="Objectifs atteints" value={report.objectivesAvailable ? `${summary.achieved} / ${summary.total}` : "—"} />
          <Metric label="Satisfaction finale" value={report.satisfactionScore === null ? "Non archivée" : `${report.satisfactionScore} %`} />
          <Metric label="Évolution de la dotation" value={summary.changePercent === null ? "—" : `${percentage.format(summary.changePercent)} %`} />
        </dl>
      </div>
      <div className="p-5 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2">
          <Budget label={`Dotation S${report.gameYear}`} amount={money(report.previousBudget, report.currencyCode)} sponsor={report.sponsorName} />
          <Budget label={`Dotation S${report.currentGameYear}`} amount={money(report.currentBudget, report.currentCurrencyCode)} sponsor={report.currentSponsorName} />
        </div>
        {summary.difference !== null ? <p className="mt-3 text-sm font-black text-[#183F37]">Variation annuelle : {signedMoney(summary.difference, report.currencyCode)}</p> : null}
        {summary.satisfactionAdjustment !== null ? (
          <div className="mt-4 rounded-xl border border-[#315B3E]/10 bg-[#F7FAF8] p-4 text-xs font-semibold leading-6 text-[#526A62]">
            <p><strong className="text-[#183F37]">Effet de la satisfaction : {percentage.format(summary.satisfactionAdjustment)} %</strong> · {money(summary.budgetAfterSatisfaction, report.currencyCode)}</p>
            {summary.otherAdjustments !== null && Math.abs(summary.otherAdjustments) >= 1 ? <p>Ambition et autres ajustements : {signedMoney(summary.otherAdjustments, report.currencyCode)}</p> : null}
            <p>La satisfaction fixe la base de reconduction. L’ambition et les conditions négociées déterminent ensuite la dotation finale.</p>
          </div>
        ) : !report.sameContract && report.currentSponsorName ? (
          <p className="mt-4 text-xs font-semibold leading-6 text-[#60756E]">Nouveau contrat : la variation compare les dotations des deux saisons et ne correspond pas uniquement à la satisfaction.</p>
        ) : null}
        <p className="mt-3 text-[11px] font-semibold leading-5 text-[#72847E]">La dotation correspond au budget annuel du sponsor, hors primes ponctuelles.</p>
        {report.objectivesAvailable ? (
          <details className="group mt-6 border-t border-[#315B3E]/10 pt-4">
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg py-2 text-sm font-black text-[#183F37] focus-visible:outline-2 focus-visible:outline-[#278B70]">
              <span>Détail des objectifs de la saison {report.gameYear}</span>
              <span className="flex items-center gap-3 text-xs font-bold text-[#60756E]">{summary.partial > 0 ? <span>{summary.partial} {summary.partial > 1 ? "réussites partielles" : "réussite partielle"}</span> : null}<span className="transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></span>
            </summary>
            <ol className="mt-3 space-y-2">{report.objectives.map(objective=><ReviewObjective key={objective.id} objective={objective} />)}</ol>
            <p className="mt-4 text-[11px] font-semibold leading-5 text-[#72847E]">La satisfaction finale comprend aussi les bonus de performances, les engagements et les bonus de l’équipe.</p>
          </details>
        ) : <p className="mt-5 rounded-xl bg-[#FFF8ED] p-4 text-xs font-semibold text-[#856232]">Le détail des objectifs de cette saison n’est pas disponible.</p>}
      </div>
    </section>
  );
}

function Metric({label, value}: {label: string; value: string}) {
  return <div className="min-w-0 rounded-xl border border-[#315B3E]/10 bg-white/80 p-3"><dt className="text-[9px] font-black uppercase tracking-wide text-[#60756E] sm:text-[10px]">{label}</dt><dd className="mt-1 break-words text-lg font-black text-[#183F37] sm:text-xl">{value}</dd></div>;
}
function Budget({label, amount, sponsor}: {label: string; amount: string; sponsor: string | null}) {
  return <div className="min-w-0 rounded-xl border border-[#315B3E]/10 p-4"><p className="text-xs font-black text-[#60756E]">{label}</p><p className="mt-1 break-words text-2xl font-black text-[#183F37]">{amount}</p>{sponsor ? <p className="mt-1 truncate text-xs font-semibold text-[#72847E]">{sponsor}</p> : null}</div>;
}
function ReviewObjective({objective}: {objective: SponsorSeasonReviewObjective}) {
  const presentation = getSponsorReviewObjectivePresentation(objective);
  const progress = getSponsorObjectiveProgressDisplay({targetDetails: objective.targetDetails, currentValue: objective.currentValue, persistedTargetValue: objective.targetValue});
  const rank = objective.targetDetails.kind === "race_result" || objective.targetDetails.kind === "uci_ranking" || objective.targetDetails.kind === "nation_uci_ranking";
  const colors = presentation.status === "achieved" ? "bg-[#E8F6EE] text-[#176951]" : presentation.status === "partial" ? "bg-[#FFF1D9] text-[#9A6216]" : presentation.status === "failed" ? "bg-[#FCEDEB] text-[#A64337]" : "bg-[#EFF2F0] text-[#60756E]";
  return (
    <li className="rounded-xl border border-[#315B3E]/10 bg-[#FAFCFB] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-52"><SponsorObjectiveTitle targetDetails={objective.targetDetails} className="text-sm font-black leading-6 text-[#183F37]">{objective.name}</SponsorObjectiveTitle></div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black ${colors}`}>{presentation.label}</span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-[#60756E]">Poids de l’objectif : {objective.satisfactionPoints} points</p>
      {rank && objective.currentValue !== null && objective.currentValue > 0 ? <p className="mt-1 text-xs font-bold text-[#526A62]">Classement final : {Math.round(objective.currentValue) === 1 ? "1er" : `${Math.round(objective.currentValue)}e`}</p> : progress ? <p className="mt-1 text-xs font-bold text-[#526A62]">{progress.label} : {progress.currentValue}{progress.unit === "percentage" ? " %" : ""} / {progress.targetValue}{progress.unit === "percentage" ? " %" : ""}</p> : null}
      {presentation.status === "partial" ? <SponsorPartialObjectiveResult level={objective.achievementLevel} points={objective.partialSatisfactionPoints} weight={objective.satisfactionPoints} achievements={objective.partialAchievements} /> : null}
    </li>
  );
}
