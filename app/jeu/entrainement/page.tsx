import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { PotentialStars } from "@/components/game/potential-stars";
import { RaceReconnaissancePlanner } from "@/components/game/race-reconnaissance-planner";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TrainingReportPopover } from "@/components/game/training-report-popover";
import {
  RiderTrainingPlanForm,
  TrainingThresholdForm,
} from "@/components/game/training-controls";

import {
  getRiderSportingProfile,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import {
  LOW_FORM_REST_GAIN,
  parseTrainingPageTab,
  type TrainingPageTab,
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
  type TeamTrainingRider,
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
    onglet?: string | string[];
    reconnaissance?: string;
  }>;
};

export default async function TrainingPage({
  searchParams,
}: TrainingPageProps) {
  const query = await searchParams;
  const activeTab = parseTrainingPageTab(query.onglet);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const [
    overview,
    headerData,
    amateurIdentity,
    sponsorIdentity,
    reconnaissanceOverview,
  ] = await Promise.all([
    getCurrentTeamTrainingOverview(user.id),
    getGameHeaderData(supabase, user.id),
    getTeamAmateurIdentityForAuthUser(user.id),
    getActiveTeamSponsorIdentityForAuthUser(user.id),
    activeTab === "reconnaissance"
      ? getCurrentTeamRaceReconnaissanceOverview(user.id)
      : Promise.resolve(null),
  ]);

  if (!overview) redirect("/jeu");
  if (activeTab === "reconnaissance" && !reconnaissanceOverview) {
    redirect("/jeu");
  }

  const jersey: RiderJerseyAppearance = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
        imagePath: sponsorIdentity.selectedJersey.imagePath,
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
        <BackToOfficeLink />

        <div className="mt-6">
          {query.erreur ? <Alert tone="error">{query.erreur}</Alert> : null}
          {query.seuil || query.programme ? (
            <Alert tone="success">
              Le réglage est enregistré et prendra effet{" "}
              {query.effet ?? "à la prochaine séance"}.
            </Alert>
          ) : null}
          {query.reconnaissance ? (
            <Alert tone="success">
              La reconnaissance est programmée. Les coureurs sélectionnés sont
              désormais indisponibles pendant ses deux jours.
            </Alert>
          ) : null}
        </div>

        <TrainingSectionTabs activeTab={activeTab} />

        {activeTab === "training" ? (
          <>
            <header className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] p-6 text-white shadow-[0_22px_60px_rgba(7,26,23,0.2)] sm:p-9">
              <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.75fr)] xl:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
                    {overview.teamName} · {overview.seasonName} · J
                    {overview.currentDayNumber}
                  </p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                    Entraînements
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
                    Séance quotidienne à 8 h. Sous le seuil de forme, le coureur
                    se repose et récupère {LOW_FORM_REST_GAIN} points. Blessure,
                    stage ou reconnaissance suspendent l’entraînement.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-white/10 px-3 py-2 text-[#D6DFD2]">
                      {overview.sessionCutoffPassed
                        ? "Séance du jour réglée"
                        : "Modifiable jusqu’à 8 h"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
                    Seuil minimal de forme
                  </p>
                  <TrainingThresholdForm minimumForm={overview.minimumForm} />
                  {overview.minimumFormIsPending ? (
                    <p className="mt-2 text-xs font-bold text-[#FFF4C5]">
                      Nouveau seuil programmé pour J
                      {overview.minimumFormEffectiveFromDayNumber}.
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
                              aria-label={`Drapeau : ${trainer.countryName}`}
                            />
                            {trainer.countryName} · {trainer.specialtyLabel}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#FFF2C7] px-3 py-1 text-xs font-black text-[#7A5B09]">
                          N{trainer.level}
                        </span>
                      </div>
                      <p className="mt-4 text-sm font-bold text-[#176951]">
                        +{trainer.efficiencyBonus}% d’efficacité sur les
                        statistiques de sa spécialité
                      </p>
                      <div className="mt-4 border-t border-[#315B3E]/10 pt-3">
                        <div className="flex items-center justify-between gap-3 text-xs font-black">
                          <span className="text-[#60756E]">
                            Coureurs suivis
                          </span>
                          <span
                            className={
                              trainer.assignedRiderCount >=
                              trainer.riderCapacity
                                ? "text-[#B54242]"
                                : "text-[#176951]"
                            }
                          >
                            {trainer.assignedRiderCount}/{trainer.riderCapacity}
                          </span>
                        </div>
                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#DCE8E3]"
                          role="progressbar"
                          aria-label={`Quota de ${trainer.firstName} ${trainer.lastName}`}
                          aria-valuemin={0}
                          aria-valuemax={trainer.riderCapacity}
                          aria-valuenow={Math.min(
                            trainer.assignedRiderCount,
                            trainer.riderCapacity,
                          )}
                        >
                          <span
                            className={`block h-full rounded-full ${
                              trainer.assignedRiderCount >=
                              trainer.riderCapacity
                                ? "bg-[#D84B4B]"
                                : "bg-[#42B99A]"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (trainer.assignedRiderCount /
                                  trainer.riderCapacity) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F7FAF8] px-5 py-5 text-sm font-semibold text-[#60756E]">
                  Aucun entraîneur n’est encore sous contrat. Les programmes
                  fonctionnent sans bonus et pourront être rattachés à un
                  entraîneur dès son recrutement.
                </p>
              )}
            </section>

            <section className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4 px-1">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
                    Programmes individuels
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-[#183F37]">
                    {overview.riders.length} coureur
                    {overview.riders.length > 1 ? "s" : ""}
                  </h2>
                </div>
                <p className="max-w-xl text-right text-xs font-semibold leading-5 text-[#60756E]">
                  Les gains hors domaine restent possibles mais faibles. Dès 32
                  ans, le déclin s’accélère de 5 % par année d’âge.
                  L’entraînement l’amortit sans permettre de dépasser le niveau
                  de début de saison.
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
                              aria-label={`Drapeau : ${rider.countryName}`}
                            />
                            {rider.countryName} · {rider.age} ans · Forme{" "}
                            {rider.form}%
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              title="Profil recalculé depuis les notes actuelles de la saison"
                              className="inline-flex rounded-full bg-[#D7EEE8] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#176951]"
                            >
                              Profil ·{" "}
                              {getRiderSportingProfile(
                                toTrainingRatings(rider.ratings),
                              )}
                            </span>
                            <PotentialStars
                              potentialSteps={rider.potentialSteps}
                              compact
                            />
                            <RiderDeclineIndicators rider={rider} />
                          </div>
                          {rider.plan.isPending ? (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-[#8A6B16]">
                              Programme à venir J
                              {rider.plan.effectiveFromDayNumber}
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

                      <TrainingReportPopover
                        report={rider.latestReport}
                        seasonReport={rider.seasonReport}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <RaceReconnaissancePlanner
            overview={reconnaissanceOverview!}
            jersey={jersey}
          />
        )}
      </section>
    </main>
  );
}

function TrainingSectionTabs({ activeTab }: { activeTab: TrainingPageTab }) {
  const tabs: Array<{
    id: TrainingPageTab;
    label: string;
    description: string;
    href: string;
  }> = [
    {
      id: "training",
      label: "Entraînements",
      description: "Programmes quotidiens",
      href: "/jeu/entrainement",
    },
    {
      id: "reconnaissance",
      label: "Stages de reconnaissance",
      description: "Préparation des parcours",
      href: "/jeu/entrainement?onglet=reconnaissance",
    },
  ];

  return (
    <nav
      aria-label="Rubriques de l’entraînement"
      className="mb-7 grid gap-3 rounded-[1.6rem] border border-[#315B3E]/12 bg-white p-2 shadow-[0_12px_34px_rgba(19,60,46,0.07)] sm:grid-cols-2"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-[1.15rem] border px-5 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] ${
              isActive
                ? "border-[#176951]/25 bg-[#176951] text-white shadow-[0_10px_24px_rgba(23,105,81,0.2)]"
                : "border-transparent bg-[#F3F8F5] text-[#183F37] hover:border-[#176951]/15 hover:bg-[#EAF5F3]"
            }`}
          >
            <span className="block text-sm font-black">{tab.label}</span>
            <span
              className={`mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] ${
                isActive ? "text-[#9BE0BC]" : "text-[#60756E]"
              }`}
            >
              {tab.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function toTrainingRatings(
  ratings: TeamTrainingRider["ratings"],
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

function RiderDeclineIndicators({ rider }: { rider: TeamTrainingRider }) {
  if (rider.age < 32) return null;

  const { declineProfile } = rider;
  const longevityLabel = {
    standard: null,
    durable: "Longévité solide",
    long_lived: "Grande longévité",
    exceptional: "Longévité exceptionnelle",
  }[declineProfile.longevityTier];
  const declineLabel =
    declineProfile.seasonPointsBeforeTraining > 0
      ? `Déclin brut · −${formatDeclinePoints(
          declineProfile.seasonPointsBeforeTraining,
        )}/saison`
      : "Déclin repoussé cette saison";

  return (
    <>
      <span
        title="Perte naturelle estimée par caractéristique avant compensation de l’entraînement."
        className="inline-flex rounded-full bg-[#FBE3DE] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#9B4538]"
      >
        {declineLabel}
      </span>
      {declineProfile.hasIronHealth ? (
        <span
          title="Santé de fer repousse le déclin d’un an puis réduit sa vitesse de 30 %."
          className="inline-flex rounded-full bg-[#303A40] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#F3F5F6]"
        >
          Santé de fer
        </span>
      ) : null}
      {longevityLabel ? (
        <span className="inline-flex rounded-full bg-[#E4E8EA] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#34434A]">
          {longevityLabel}
        </span>
      ) : null}
    </>
  );
}

function formatDeclinePoints(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "error";
}) {
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
