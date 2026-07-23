import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { PotentialStars } from "@/components/game/potential-stars";
import { RaceReconnaissancePlanner } from "@/components/game/race-reconnaissance-planner";
import { RiderAvatar } from "@/components/game/rider-avatar";
import {
  RiderTrainingPlanForm,
  TrainingThresholdForm,
} from "@/components/game/training-controls";
import { TRAINER_SPECIALTY_LABELS } from "@/lib/game/staff";
import {
  getRiderSportingProfile,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import {
  formatTrainingProgressMilli,
  LOW_FORM_REST_GAIN,
  TRAINING_DOMAIN_LABELS,
} from "@/lib/game/training";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamTrainingOverview,
  type RiderTrainingReport,
  type TeamTrainingRider,
  type TrainingSessionStatus,
} from "@/services/team-training";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentityForAuthUser } from "@/services/team-sponsor-identity";
import { getCurrentTeamRaceReconnaissanceOverview } from "@/services/team-race-reconnaissance";

export const metadata: Metadata = {
  title: "Entraînements",
  description:
    "Pilotez les programmes quotidiens, la forme et la progression des coureurs.",
};

type TrainingPageProps = {
  searchParams: Promise<{
    seuil?: string;
    programme?: string;
    effet?: string;
    erreur?: string;
    reconnaissance?: string;
  }>;
};

const STAT_LABELS: Record<string, string> = {
  mountain: "MON",
  hills: "VAL",
  flat: "PLA",
  time_trial: "CLM",
  cobbles: "PAV",
  sprint: "SPR",
  acceleration: "ACC",
  downhill: "DES",
  endurance: "END",
  resistance: "RES",
  recovery: "REC",
  breakaway: "BAR",
  prologue: "PRO",
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

export default async function TrainingPage({ searchParams }: TrainingPageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const [
    overview,
    reconnaissanceOverview,
    headerData,
    amateurIdentity,
    sponsorIdentity,
  ] = await Promise.all([
    getCurrentTeamTrainingOverview(user.id),
    getCurrentTeamRaceReconnaissanceOverview(user.id),
    getGameHeaderData(supabase, user.id),
    getTeamAmateurIdentityForAuthUser(user.id),
    getActiveTeamSponsorIdentityForAuthUser(user.id),
  ]);

  if (!overview || !reconnaissanceOverview) redirect("/jeu");

  const jersey: RiderJerseyAppearance = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-11">
        <Link
          href="/jeu"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
        >
          <span aria-hidden="true">←</span>
          Retour au bureau du DS
        </Link>

        <div className="mt-6">
          {query.erreur ? <Alert tone="error">{query.erreur}</Alert> : null}
          {query.seuil || query.programme ? (
            <Alert tone="success">
              Le réglage est enregistré et prendra effet {query.effet ?? "à la prochaine séance"}.
            </Alert>
          ) : null}
          {query.reconnaissance ? (
            <Alert tone="success">
              La reconnaissance est programmée. Les coureurs sélectionnés sont
              désormais indisponibles pendant ses deux jours.
            </Alert>
          ) : null}
        </div>

        <header className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] p-6 text-white shadow-[0_22px_60px_rgba(7,26,23,0.2)] sm:p-9">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.75fr)] xl:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
                {overview.teamName} · {overview.seasonName} · J{overview.currentDayNumber}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Entraînements
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
                Chaque séance est réglée à 8 h, heure de Paris. Une modification faite après
                8 h s’applique au lendemain. Un coureur engagé en course peut s’entraîner le
                matin ; une blessure ou un stage de forme le rend indisponible.
                Si sa forme est sous le seuil fixé par le DS, il se repose et récupère
                automatiquement {LOW_FORM_REST_GAIN} points de forme.
                Une reconnaissance remplace ce cycle pendant deux jours : ni
                séance, ni récupération passive.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-white/10 px-3 py-2 text-[#FFF4C5]">
                  Fatigue désactivée · seule la forme compte
                </span>
                <span className="rounded-full bg-white/10 px-3 py-2 text-[#D6DFD2]">
                  {overview.sessionCutoffPassed
                    ? "Séance du jour réglée ou en cours de règlement"
                    : "Réglages encore modifiables pour aujourd’hui"}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
                Garde-fou collectif
              </p>
              <TrainingThresholdForm minimumForm={overview.minimumForm} />
              {overview.minimumFormIsPending ? (
                <p className="mt-2 text-xs font-bold text-[#FFF4C5]">
                  Nouveau seuil programmé pour J{overview.minimumFormEffectiveFromDayNumber}.
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
                Staff technique
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Entraîneurs disponibles
              </h2>
            </div>
            <Link
              href="/jeu/staff"
              className="rounded-xl border border-[#176951]/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#176951] transition hover:bg-[#EAF5F3]"
            >
              Gérer le staff
            </Link>
          </div>

          {overview.trainers.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overview.trainers.map((trainer) => (
                <article
                  key={trainer.contractId}
                  className="rounded-2xl border border-[#315B3E]/12 bg-[#F7FAF8] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[#183F37]">
                        {trainer.firstName} {trainer.lastName}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#60756E]">
                        <span
                          className={`fi fi-${trainer.countryCode.toLowerCase()} mr-2 rounded-sm`}
                          role="img"
                          aria-label={`Drapeau : ${trainer.countryName}`}
                        />
                        {trainer.countryName} · {trainer.specialtyLabel}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#FFF2C7] px-3 py-1 text-xs font-black text-[#7A5B09]">
                      N{trainer.level}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-bold text-[#176951]">
                    +{trainer.efficiencyBonus}% d’efficacité sur les statistiques de sa spécialité
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F7FAF8] px-5 py-5 text-sm font-semibold text-[#60756E]">
              Aucun entraîneur n’est encore sous contrat. Les programmes fonctionnent sans
              bonus et pourront être rattachés à un entraîneur dès son recrutement.
            </p>
          )}
        </section>

        <RaceReconnaissancePlanner
          overview={reconnaissanceOverview}
          jersey={jersey}
        />

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-4 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
                Programmes individuels
              </p>
              <h2 className="mt-2 text-3xl font-black text-[#183F37]">
                {overview.riders.length} coureur{overview.riders.length > 1 ? "s" : ""}
              </h2>
            </div>
            <p className="max-w-xl text-right text-xs font-semibold leading-5 text-[#60756E]">
              Les gains hors domaine restent possibles mais faibles. Après 32 ans,
              l’entraînement amortit le déclin sans permettre de dépasser le niveau de début de saison.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {overview.riders.map((rider) => (
              <article
                key={rider.id}
                className="rounded-[1.75rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_36px_rgba(19,60,46,0.07)] sm:p-6"
              >
                <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)_150px] xl:items-center">
                  <div className="flex min-w-0 items-center gap-4">
                    <RiderAvatar
                      profileKey={rider.avatarProfileKey}
                      seed={rider.avatarSeed}
                      riderId={rider.id}
                      age={rider.age}
                      jersey={jersey}
                      label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                      className="h-16 w-16"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/jeu/coureurs/${rider.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-lg font-black text-[#183F37] transition hover:text-[#278B70]"
                      >
                        {rider.firstName} {rider.lastName} ↗
                      </Link>
                      <p className="mt-1 flex items-center gap-2 text-xs font-bold text-[#60756E]">
                        <span
                          className={`fi fi-${rider.countryCode.toLowerCase()} rounded-sm`}
                          role="img"
                          aria-label={`Drapeau : ${rider.countryName}`}
                        />
                        {rider.countryName} · {rider.age} ans · Forme {rider.form}%
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          title="Profil recalculé depuis les notes actuelles de la saison"
                          className="inline-flex rounded-full bg-[#D7EEE8] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#176951]"
                        >
                          Profil · {getRiderSportingProfile(toTrainingRatings(rider.ratings))}
                        </span>
                        <PotentialStars potentialSteps={rider.potentialSteps} compact />
                      </div>
                      {rider.plan.isPending ? (
                        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-[#8A6B16]">
                          Programme à venir J{rider.plan.effectiveFromDayNumber}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <RiderTrainingPlanForm
                    riderId={rider.id}
                    initialIntensity={rider.plan.intensity}
                    initialDomain={rider.plan.domain}
                    initialTrainerContractId={rider.plan.trainerContractId}
                    riderCountryCode={rider.countryCode}
                    trainers={overview.trainers}
                  />

                  <TrainingReportPopover report={rider.latestReport} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function toTrainingRatings(
  ratings: TeamTrainingRider["ratings"]
): RiderRatings {
  return {
    mountain: ratings.mountain,
    hills: ratings.hills,
    flat: ratings.flat,
    timeTrial: ratings.time_trial,
    cobbles: ratings.cobbles,
    sprint: ratings.sprint,
    acceleration: ratings.acceleration,
    downhill: ratings.downhill,
    endurance: ratings.endurance,
    resistance: ratings.resistance,
    recovery: ratings.recovery,
    breakaway: ratings.breakaway,
    prologue: ratings.prologue,
  };
}

function TrainingReportPopover({ report }: { report: RiderTrainingReport | null }) {
  if (!report) {
    return (
      <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dashed border-[#315B3E]/20 px-3 text-center text-xs font-black text-[#7B8D87]">
        Aucun rapport
      </span>
    );
  }

  const isCompleted = report.status === "completed";
  const isLowFormRest = report.status === "skipped_low_form";
  const displaysFormChange = isCompleted || isLowFormRest;
  const ratingChanges = sortStatEntries(report.ratingChanges).filter(
    ([, value]) => value !== 0,
  );
  const trainingProgress = sortStatEntries(report.progressMilli)
    .filter(([, value]) => value > 0)
  const declineProgress = sortStatEntries(report.declineMilli).filter(
    ([, value]) => value > 0,
  );

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[#176951]/20 bg-[#EAF5F3] px-3 text-center text-xs font-black text-[#176951] transition hover:bg-[#DDF1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]">
        Rapport J{report.dayNumber}
      </summary>
      <div className="invisible absolute right-0 z-30 mt-2 w-[min(360px,85vw)] translate-y-1 rounded-2xl border border-[#315B3E]/15 bg-[#071A17] p-5 text-white opacity-0 shadow-2xl transition group-open:visible group-open:translate-y-0 group-open:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
              {STATUS_LABELS[report.status]}
            </p>
            <p className="mt-1 font-black">
              {isCompleted
                ? `${TRAINING_DOMAIN_LABELS[report.domain]} · ${report.intensity}%`
                : SKIPPED_REASON_LABELS[report.status]}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
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
                    value={report.physiotherapistLevel > 0 ? `N${report.physiotherapistLevel}` : "Aucun"}
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
                    <span className="text-[#D6DFD2]">{STAT_LABELS[stat] ?? stat}</span>
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
              : "Aucune note entière n’a changé : les décimales sont conservées en base pour les prochaines séances."}
          </p>
        </div>
      </div>
    </details>
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
      <dt className="font-black uppercase tracking-wider text-[#8EB9AA]">{label}</dt>
      <dd className="mt-1 font-black text-white">{value}</dd>
    </div>
  );
}

function Alert({ children, tone }: { children: React.ReactNode; tone: "success" | "error" }) {
  return (
    <p
      className={`mb-5 rounded-2xl border px-5 py-4 text-sm font-bold ${
        tone === "success"
          ? "border-[#42B99A]/25 bg-[#DFF5EA] text-[#176951]"
          : "border-[#C94F4F]/25 bg-[#FFF0EE] text-[#8A2F2F]"
      }`}
    >
      {children}
    </p>
  );
}
