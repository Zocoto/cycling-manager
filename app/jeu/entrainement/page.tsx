import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { PotentialStars } from "@/components/game/potential-stars";
import { RaceReconnaissancePlanner } from "@/components/game/race-reconnaissance-planner";
import { RiderPreparationCenter } from "@/components/game/rider-preparation-center";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TrainingReportPopover } from "@/components/game/training-report-popover";
import { TrainerOverviewCard } from "@/components/game/trainer-overview-card";
import { TeamProgressionModal } from "@/components/game/team-progression-modal";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import {
  RiderTrainingPlanFields,
  TrainingPlansEditor,
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
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamTrainingOverview,
  type TeamTrainingRider,
} from "@/services/team-training";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentityForAuthUser } from "@/services/team-sponsor-identity";
import { getCurrentTeamRaceReconnaissanceOverview } from "@/services/team-race-reconnaissance";
import { getCurrentTeamRiderPreparationOverview } from "@/services/team-rider-preparation";
import { getRiderProgressionHistories } from "@/services/rider-progression";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import {
  TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
  TRAINING_TUTORIAL_KEY,
  TRAINING_TUTORIAL_ROUTE,
} from "@/lib/tutorial/training";

export const metadata: Metadata = {
  title: "Entraînements",
  description:
    "Pilotez les programmes quotidiens, la forme et la progression des coureurs.",
};

export const maxDuration = 300;

type TrainingPageProps = {
  searchParams: Promise<{
    seuil?: string;
    programme?: string;
    nombre?: string;
    effet?: string;
    erreur?: string;
    onglet?: string | string[];
    reconnaissance?: string;
    preparation?: string;
    progression?: string;
    coureur?: string;
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
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [
    overview,
    headerData,
    amateurIdentity,
    sponsorIdentity,
    reconnaissanceOverview,
    preparationOverview,
    trainingTutorialProgress,
  ] = await Promise.all([
    getCurrentTeamTrainingOverview(user.id),
    getGameHeaderData(supabase, user.id),
    getTeamAmateurIdentityForAuthUser(user.id),
    getActiveTeamSponsorIdentityForAuthUser(user.id),
    activeTab === "reconnaissance"
      ? getCurrentTeamRaceReconnaissanceOverview(user.id)
      : Promise.resolve(null),
    activeTab === "preparation"
      ? getCurrentTeamRiderPreparationOverview(user.id)
      : Promise.resolve(null),
    getAuthenticatedTutorialProgress(supabase, TRAINING_TUTORIAL_KEY).catch(
      (error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel de l’entraînement :",
          error,
        );
        return null;
      },
    ),
  ]);

  if (!overview) redirect("/jeu");
  if (activeTab === "reconnaissance" && !reconnaissanceOverview) {
    redirect("/jeu");
  }
  if (activeTab === "preparation" && !preparationOverview) {
    redirect("/jeu");
  }

  const progressionHistories =
    activeTab === "training"
      ? await getRiderProgressionHistories({
          riderIds: overview.riders.map((rider) => rider.id),
          currentSeasonId: overview.seasonId,
        })
      : [];

  const jersey: RiderJerseyAppearance = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
        imagePath: sponsorIdentity.selectedJersey.imagePath,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;
  const currentTrainingTutorialRoute =
    activeTab === "reconnaissance"
      ? TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE
      : TRAINING_TUTORIAL_ROUTE;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {trainingTutorialProgress?.status === "in_progress" &&
      trainingTutorialProgress.current_route === currentTrainingTutorialRoute &&
      trainingTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={TRAINING_TUTORIAL_KEY}
          currentStepKey={trainingTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-11">
        <div className="flex items-center justify-between gap-4">
          <BackToOfficeLink />
          <TutorialLaunchButton tutorialKey={TRAINING_TUTORIAL_KEY} iconOnly />
        </div>

        <div className="mt-6">
          {query.erreur ? <Alert tone="error">{query.erreur}</Alert> : null}
          {query.seuil ? (
            <Alert tone="success">
              Le seuil est enregistré et prendra effet{" "}
              {query.effet ?? "à la prochaine séance"}.
            </Alert>
          ) : null}
          {query.programme ? (
            <Alert tone="success">
              {Number(query.nombre) > 1
                ? `${Number(query.nombre)} programmes modifiés sont enregistrés et prendront effet`
                : "Le programme modifié est enregistré et prendra effet"}{" "}
              {query.effet ?? "à la prochaine séance"}.
            </Alert>
          ) : null}
          {query.reconnaissance ? (
            <Alert tone="success">
              La reconnaissance est programmée. Les coureurs sélectionnés sont
              désormais indisponibles pendant ses deux jours.
            </Alert>
          ) : null}
          {query.preparation ? (
            <Alert tone="success">
              La préparation est programmée. Le coureur est indisponible pendant
              deux jours, puis son bonus temporaire s’activera.
            </Alert>
          ) : null}
        </div>

        <TrainingSectionTabs activeTab={activeTab} />

        {activeTab === "training" ? (
          <>
            <header
              data-tutorial-id="training-overview"
              className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] p-6 text-white shadow-[0_22px_60px_rgba(7,26,23,0.2)] sm:p-9"
            >
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
                    <TeamProgressionModal
                      riders={overview.riders.map((rider) => ({
                        id: rider.id,
                        firstName: rider.firstName,
                        lastName: rider.lastName,
                        countryCode: rider.countryCode,
                        age: rider.age,
                      }))}
                      histories={progressionHistories}
                      initiallyOpen={query.progression === "1"}
                      initialRiderId={query.coureur}
                    />
                  </div>
                </div>

                <div data-tutorial-id="training-threshold">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
                    Seuil minimal de forme
                  </p>
                  <TrainingThresholdForm minimumForm={overview.minimumForm} />
                  {overview.minimumFormIsPending ? (
                    <p className="mt-2 text-xs font-bold text-[#FFF4C5]">
                      {overview.minimumFormEffectiveFromDayNumber === 29
                        ? "Nouveau seuil programm\u00e9 pour la prochaine saison \u00b7 J1 \u00e0 8 h."
                        : `Nouveau seuil programm\u00e9 pour J${overview.minimumFormEffectiveFromDayNumber}.`}
                    </p>
                  ) : null}
                </div>
              </div>
            </header>

            <section
              data-tutorial-id="training-staff"
              className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8"
            >
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
                    <TrainerOverviewCard
                      key={trainer.contractId}
                      trainer={trainer}
                    />
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

              <TrainingPlansEditor
                key={overview.riders
                  .map(
                    (rider) =>
                      `${rider.id}:${rider.plan.intensity}:${rider.plan.domain}:${rider.plan.trainerContractId ?? ""}`,
                  )
                  .join("|")}
                initialPlans={overview.riders.map((rider) => ({
                  riderId: rider.id,
                  intensity: rider.plan.intensity,
                  domain: rider.plan.domain,
                  trainerContractId: rider.plan.trainerContractId,
                }))}
              >
                <div className="mt-5 space-y-4">
                  {overview.riders.map((rider, riderIndex) => (
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
                                {rider.plan.effectiveFromDayNumber === 29
                                  ? "Programme \u00e0 venir \u00b7 prochaine saison J1 \u00e0 8 h"
                                  : `Programme \u00e0 venir J${rider.plan.effectiveFromDayNumber}`}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <RiderTrainingPlanFields
                          riderId={rider.id}
                          riderCountryCode={rider.countryCode}
                          trainers={overview.trainers}
                          tutorialTargetPrefix={
                            riderIndex === 0 ? "training-plan" : undefined
                          }
                        />

                        <TrainingReportPopover
                          report={rider.latestReport}
                          seasonReport={rider.seasonReport}
                          tutorialTargetId={
                            riderIndex === 0 ? "training-report" : undefined
                          }
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </TrainingPlansEditor>
            </section>
          </>
        ) : activeTab === "preparation" ? (
          <RiderPreparationCenter overview={preparationOverview!} />
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
      id: "preparation",
      label: "Préparation coureurs",
      description: "Piste indoor et soufflerie",
      href: "/jeu/entrainement?onglet=preparation",
    },
    {
      id: "reconnaissance",
      label: "Stages de reconnaissance",
      description: "Préparation des parcours",
      href: "/jeu/entrainement?onglet=reconnaissance",
    },
  ];

  return (
    <GameSectionTabs
      ariaLabel="Rubriques de l’entraînement"
      columns={3}
      className="mb-7"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <GameSectionTabLink
            key={tab.id}
            href={tab.href}
            active={isActive}
            label={tab.label}
            description={tab.description}
          />
        );
      })}
    </GameSectionTabs>
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
