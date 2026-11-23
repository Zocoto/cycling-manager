import { naturalizeYouthRiderAction } from "@/app/jeu/centre-de-formation/actions";
import { NaturalizationCard } from "@/components/game/naturalization-card";
import { PotentialStars } from "@/components/game/potential-stars";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RiderMoraleGauge } from "@/components/game/rider-morale-gauge";
import { RiderPersonalityBadge } from "@/components/game/rider-personality";
import { SpecialAbilityMedallion } from "@/components/game/special-ability-medallion";
import { YouthPromotionForm } from "@/components/game/youth-promotion-form";
import { YouthTrainingMiniGame } from "@/components/game/youth-training-mini-game";
import { YouthDismissalSelectionField, YouthTrainingSettingsFields } from "@/components/game/youth-training-bulk-editor";
import { RIDER_RATING_AXES, type RiderRatingKey } from "@/lib/game/rider-profile";
import type { ReactNode } from "react";
import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";
import { getTrainingDomainChoiceLabel } from "@/lib/game/training";
import type { AcademyYouth } from "@/services/youth-development";

export function AcademyRiderCard({
  rider,
  gameYear,
  currency,
  canSchedulePromotion,
  rosterLimit,
}: {
  rider: AcademyYouth;
  gameYear: number;
  currency: string;
  canSchedulePromotion: boolean;
  rosterLimit: number;
}) {
  const releasePending = rider.status === "release_pending";
  const fullName = `${rider.firstName} ${rider.lastName}`;
  const trainingStatus = rider.trainingMode === "manual"
    ? <>{rider.manualTraining.completedSlotCount}/2 · <span>Manuel</span></>
    : "Automatique";

  return (
    <article
      data-academy-rider-card
      id={`junior-${rider.id}`}
      aria-label={fullName}
      className="min-w-0 rounded-2xl border-2 border-[#315B3E]/18 bg-white shadow-[0_6px_20px_rgba(19,60,46,0.06)]"
    >
      <div className="lg:grid lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
      <header className="flex min-w-0 items-start gap-3 rounded-t-[0.9rem] border-b border-[#315B3E]/10 bg-[#F1F7F3] p-3 sm:items-center sm:px-4 lg:rounded-tr-none lg:border-r lg:border-b-0">
        <RiderAvatar profileKey={rider.profileKey} seed={rider.avatarSeed} riderId={rider.id} age={rider.age} label={fullName} className="h-12 w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-black leading-5 text-[#071A17]">{fullName}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-[#60756E]">
            <span className={`fi fi-${rider.countryCode.toLowerCase()} h-3 w-4 shrink-0 rounded-sm`} role="img" aria-label={rider.countryName} />
            <span>{rider.age} ans</span><span aria-hidden="true">·</span>
            <span className="font-extrabold text-[#176951]">{rider.sportingProfile}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <PotentialStars potentialSteps={rider.potentialSteps} compact />
            <div className="shrink-0"><RiderMoraleGauge value={rider.morale} events={rider.moraleEvents} compact /></div>
          </div>
        </div>
      </header>

      <div className="min-w-0 lg:flex lg:flex-col lg:justify-center">
      <div className="px-3 pb-2 pt-2.5 sm:px-4">
        <RatingsGrid ratings={rider.ratings} importance="primary" />
      </div>
      {rider.nativeSpecialAbility || rider.age === 18 || rider.status === "recruited" || releasePending ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 sm:px-4">
          {rider.nativeSpecialAbility ? <span title={rider.nativeSpecialAbility.effect} className="rounded-md border border-[#D6A93D]/25 bg-[#FFF8DD] px-2 py-1 text-[10px] font-extrabold text-[#806114]">{rider.nativeSpecialAbility.name}</span> : null}
          {rider.age === 18 ? <span className="rounded-md bg-[#FFF0C7] px-2 py-1 text-[10px] font-extrabold text-[#806114]">Dernière année</span> : null}
          {rider.status === "recruited" ? <span className="rounded-md bg-[#E5F4EC] px-2 py-1 text-[10px] font-extrabold text-[#176951]">Passage pro la saison prochaine · {rider.promotionGameYear}</span> : null}
          {releasePending ? <span className="rounded-md bg-[#FFF0DD] px-2 py-1 text-[10px] font-extrabold text-[#986A17]">Départ programmé · fin de saison {gameYear}</span> : null}
        </div>
      ) : null}
      </div>
      </div>

      <div className="divide-y divide-[#315B3E]/10 border-t border-[#315B3E]/10">
        <AcademyRiderSection section="profile" title="Profil complet" riderName={fullName} detail="Notes secondaires et aptitudes">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">Notes secondaires</p>
              <RatingsGrid ratings={rider.ratings} importance="secondary" />
              {rider.heightCm !== null && rider.weightKg !== null ? <p className="mt-3 text-xs font-bold text-[#60756E]">{rider.heightCm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} cm · {rider.weightKg.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</p> : null}
            </div>
            <div className="space-y-3">
              <RiderPersonalityBadge personality={rider.personalityKey} showDescription />
              {rider.nativeSpecialAbility ? (
                <div className="flex items-center gap-3 rounded-xl border border-[#D6A93D]/20 bg-[#FFF8DD] p-3">
                  <SpecialAbilityMedallion ability={rider.nativeSpecialAbility} unlocked tooltipLayout="responsive" />
                  <div className="min-w-0 text-xs"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#806114]">Talent natif</p><p className="mt-1 font-black text-[#183F37]">{rider.nativeSpecialAbility.name}</p><p className="mt-1 font-semibold leading-5 text-[#60756E]">{rider.nativeSpecialAbility.effect}</p></div>
                </div>
              ) : null}
            </div>
          </div>
        </AcademyRiderSection>

        {!releasePending ? (
          <AcademyRiderSection section="training" title="Entraînement" riderName={fullName} detail={trainingStatus} attention={rider.trainingMode === "manual" && !rider.manualTraining.currentSlotCompleted}>
            <p className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#60756E]">
              <span>{getTrainingDomainChoiceLabel(rider.trainingPriority)}</span>
              {rider.trainingMode === "manual" && !rider.manualTraining.currentSlotCompleted ? <span className="rounded-full bg-[#FFF0C7] px-2 py-1 font-black text-[#806114]">Séance à jouer</span> : null}
            </p>
            <div className="grid items-start gap-3 lg:grid-cols-2">
              <YouthTrainingSettingsFields academyRiderId={rider.id} pendingTrainingMode={rider.pendingTrainingMode} />
              <YouthTrainingMiniGame academyRiderId={rider.id} riderName={fullName} trainingMode={rider.trainingMode} gameType={rider.manualTraining.gameType} currentSlotLabel={rider.manualTraining.currentSlotLabel} currentSlotCompleted={rider.manualTraining.currentSlotCompleted} completedSlotCount={rider.manualTraining.completedSlotCount} portalDialog />
              <div className="min-w-0 lg:col-span-2"><YouthTrainingReports latestReport={rider.latestTrainingReport} seasonReport={rider.seasonTrainingReport} /></div>
            </div>
          </AcademyRiderSection>
        ) : null}

        <AcademyRiderSection section="management" title="Gestion" riderName={fullName} detail={releasePending ? "Départ programmé" : "Scolarité et avenir"} attention={!releasePending && rider.age === 18 && rider.status !== "recruited"}>
          {releasePending ? (
            <div className="rounded-xl border border-[#D99A2B]/25 bg-[#FFF9EA] p-3">
              <p className="text-xs font-black text-[#986A17]">Départ programmé · fin de saison {gameYear}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#654B20]">Le junior reste dans l’école jusqu’au changement de saison, sans nouvel entraînement ni frais de scolarité. Il rejoindra les agents libres au début de la saison {gameYear + 1}.</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#806630]">Sa place en Development Team et toute promotion professionnelle programmée ont été annulées.</p>
            </div>
          ) : (
            <div className="grid items-start gap-3 lg:grid-cols-2">
              <div data-academy-rider-footer className="rounded-xl border border-[#315B3E]/10 bg-white p-3">
                <p className="mb-3 text-xs font-bold text-[#60756E]">Scolarité : <strong className="text-[#183F37]">{formatCurrency(rider.tuitionPerSeason, currency)} / saison</strong></p>
                {rider.status === "recruited" ? <p className="rounded-lg bg-[#F2C94C]/20 px-3 py-2.5 text-xs font-black text-[#8A6B16]">Passage pro la saison prochaine · {rider.promotionGameYear}</p> : rider.canRecruit ? canSchedulePromotion ? <YouthPromotionForm academyRiderId={rider.id} nextGameYear={gameYear + 1} /> : <p className="rounded-lg bg-[#FFF0EE] px-3 py-2.5 text-xs font-bold text-[#8A2F2F]">Promotion impossible · {rosterLimit} places déjà engagées.</p> : <p className="text-xs font-bold text-[#60756E]">Recrutable à partir de 17 ans.</p>}
              </div>
              <NaturalizationCard eligibility={rider.naturalization} subjectName={fullName} subjectId={rider.id} subjectIdField="academyRiderId" action={naturalizeYouthRiderAction} compact />
              <details className="group rounded-xl border border-[#C94848]/20 bg-[#FFF8F6] lg:col-span-2">
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs font-black text-[#8A2F2F] marker:content-none"><span>Programmer le départ</span><span className="text-[10px] font-bold">Fin de saison · sans frais</span></summary>
                <div className="border-t border-[#C94848]/15 p-3">
                  <p className="text-xs font-bold leading-5 text-[#775959]">Le junior restera visible dans l’école jusqu’à la fin de la saison, mais sa formation et ses futurs frais de scolarité s’arrêteront immédiatement. Il ne rejoindra les agents libres qu’au début de la saison {gameYear + 1}.</p>
                  <p className="mt-2 text-[10px] font-semibold leading-4 text-[#8A6660]">Il sera également retiré de la Development Team et de ses sélections futures. Une inscription devenue incomplète sera retirée automatiquement.</p>
                  {rider.status === "recruited" ? <p className="mt-2 rounded-lg bg-[#FBE4DF] px-3 py-2 text-[10px] font-black text-[#8A2F2F]">Sa promotion déjà programmée en équipe première sera annulée.</p> : null}
                  <div className="mt-3"><YouthDismissalSelectionField academyRiderId={rider.id} riderName={fullName} /></div>
                </div>
              </details>
            </div>
          )}
        </AcademyRiderSection>
      </div>
    </article>
  );
}

function AcademyRiderSection({ section, title, riderName, detail, attention = false, children }: {
  section: "profile" | "training" | "management";
  title: string;
  riderName: string;
  detail: ReactNode;
  attention?: boolean;
  children: ReactNode;
}) {
  // Keep the existing controls mounted so folding a section preserves local decisions.
  return (
    <details data-academy-section={section} className="group/academy-section">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-black text-[#183F37] transition hover:bg-[#F1F7F3] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#278B70] sm:px-4 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex min-w-0 items-center justify-end gap-2">
          <span className={`text-right text-[10px] font-bold ${attention ? "text-[#986A17]" : "text-[#60756E]"}`}>{detail}</span>
          {attention ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#D99A2B]" /> : null}
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4 shrink-0 transition group-open/academy-section:rotate-180"><path d="m5 7.5 5 5 5-5" /></svg>
        </span>
      </summary>
      <div className="border-t border-[#315B3E]/10 bg-[#F8FBF9] p-3 sm:p-4">
        <p className="mb-3 text-[9px] font-black uppercase tracking-[0.12em] text-[#278B70]">{riderName}</p>
        {children}
      </div>
    </details>
  );
}

function YouthTrainingReports({
  latestReport,
  seasonReport,
}: {
  latestReport: AcademyYouth["latestTrainingReport"];
  seasonReport: AcademyYouth["seasonTrainingReport"];
}) {
  return (
    <section className="h-full overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-white">
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#278B70]">
              Résultat du dernier entraînement
            </p>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-[#60756E]">
              Une seule séance, automatique ou manuelle, avec le détail des 13
              statistiques.
            </p>
          </div>
          {latestReport ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              <span className="rounded-full bg-[#EAF5F3] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#176951]">
                J{latestReport.dayNumber}
              </span>
              <span className="rounded-full bg-[#173D35] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-white">
                {formatYouthTrainingReportMode(latestReport)}
              </span>
              {latestReport.score !== null ? (
                <span className="rounded-full bg-[#FFF2B9] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#806114]">
                  {latestReport.score}/1000
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {latestReport ? (
          <div className="mt-3">
            <p className="mb-2 text-[8px] font-black uppercase tracking-[0.12em] text-[#60756E]">
              Gains appliqués lors de cette séance
            </p>
            <YouthTrainingGainGrid changes={latestReport.ratingChanges} />
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-[#F5F7F5] px-3 py-2.5 text-[10px] font-bold leading-4 text-[#60756E]">
            Aucun entraînement enregistré pour ce junior cette saison.
          </p>
        )}
      </div>

      <details className="group border-t border-[#315B3E]/10 bg-[#F8FBF9]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-[#176951] marker:content-none">
          <span>Gains depuis le début de saison</span>
          <span className="rounded-full border border-[#176951]/20 bg-white px-2.5 py-1 text-[8px] group-open:hidden">
            Afficher
          </span>
          <span className="hidden rounded-full border border-[#176951]/20 bg-white px-2.5 py-1 text-[8px] group-open:inline-flex">
            Masquer
          </span>
        </summary>
        <div className="border-t border-[#315B3E]/10 px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[9px] font-bold text-[#60756E]">
              Cumul de J{seasonReport.fromDayNumber} à J
              {seasonReport.toDayNumber}
            </p>
            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#48665F]">
              {seasonReport.sessionCount} séance
              {seasonReport.sessionCount > 1 ? "s" : ""}
              {" · "}
              {seasonReport.automaticSessionCount} auto
              {" · "}
              {seasonReport.manualSessionCount} manuelle
              {seasonReport.manualSessionCount > 1 ? "s" : ""}
            </p>
          </div>
          <YouthTrainingGainGrid changes={seasonReport.ratingChanges} />
        </div>
      </details>
    </section>
  );
}

function YouthTrainingGainGrid({
  changes,
}: {
  changes: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
      {RIDER_RATING_AXES.map((axis) => {
        const gain = changes[axis.key] ?? 0;

        return (
          <div
            key={axis.key}
            title={axis.label}
            className={`rounded-lg border px-1 py-2 text-center ${
              gain > 0
                ? "border-[#278B70]/20 bg-[#E4F3EC]"
                : "border-[#315B3E]/8 bg-[#F2F5F3]"
            }`}
          >
            <span className="block text-[8px] font-black uppercase text-[#60756E]">
              {axis.shortLabel}
            </span>
            <strong
              className={`mt-0.5 block text-[10px] ${
                gain > 0 ? "text-[#176951]" : "text-[#91A098]"
              }`}
            >
              {formatYouthTrainingGain(gain)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function formatYouthTrainingReportMode(
  report: NonNullable<AcademyYouth["latestTrainingReport"]>,
) {
  if (report.trainingMode === "automatic") return "Automatique";
  return report.slot === "manual_am" ? "Manuel · matin" : "Manuel · soir";
}

function formatYouthTrainingGain(value: number) {
  if (value <= 0) return "0";
  return `+${value.toFixed(3).replace(".", ",")}`;
}
function RatingsGrid({ ratings, importance }: {
  ratings: Record<RiderRatingKey, number>;
  importance: "primary" | "secondary";
}) {
  const axes = RIDER_RATING_AXES.filter((axis) => axis.importance === importance);
  return (
    <div className={`grid gap-1 ${importance === "primary" ? "grid-cols-6" : "grid-cols-4 sm:grid-cols-7"}`}>
      {axes.map((axis) => <div key={axis.key} title={axis.label} data-rating-importance={axis.importance}
        className={`min-w-0 rounded-lg border px-0.5 py-1.5 text-center ${getRiderRatingColorClasses(ratings[axis.key], axis.importance)}`}>
        <span className="block text-[8px] font-black uppercase leading-3">{axis.shortLabel}</span>
        <strong className="mt-0.5 block text-[11px] font-black tabular-nums leading-4">{ratings[axis.key].toFixed(1)}</strong>
      </div>)}
    </div>
  );
}
function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
