import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import {
  markYouthScoutingReportViewedAction,
  naturalizeYouthRiderAction,
  recruitYouthRiderAction,
  signYouthCandidateAction,
} from "@/app/jeu/centre-de-formation/actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import {
  DevelopmentTeamPanel,
  type DevelopmentTeamView,
} from "@/components/game/development-team-panel";
import { GameHeader } from "@/components/game/game-header";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import { NaturalizationCard } from "@/components/game/naturalization-card";
import { PotentialStars } from "@/components/game/potential-stars";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TransferScoutingReportPanel } from "@/components/game/transfer-scouting-report";
import { YouthTrainingMiniGame } from "@/components/game/youth-training-mini-game";
import { YouthScoutingMap } from "@/components/game/youth-scouting-map";
import {
  YouthTrainingBulkEditor,
  YouthTrainingSettingsFields,
} from "@/components/game/youth-training-bulk-editor";
import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
} from "@/lib/game/rider-profile";
import { TRAINING_DOMAIN_LABELS } from "@/lib/game/training";
import type { TransferScoutingReport } from "@/lib/game/transfer-scouting";
import {
  areAllYouthScoutingCandidatesRecruited,
  isYouthScoutingMissionArchived,
} from "@/lib/game/youth-scouting-history";
import {
  YOUTH_TRAINING_GAME_LABELS,
  type YouthTrainingGameType,
} from "@/lib/game/youth-training";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import {
  YOUTH_DEVELOPMENT_ACADEMY_ROUTE,
  YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
  YOUTH_DEVELOPMENT_TUTORIAL_DEMO_VALUE,
  YOUTH_DEVELOPMENT_TUTORIAL_KEY,
} from "@/lib/tutorial/youth-development";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getDevelopmentTeamOverview,
  type DevelopmentTeamOverview,
} from "@/services/development-team";
import {
  getYouthDevelopmentOverview,
  type AcademyYouth,
  type YouthCandidate,
  type YouthDevelopmentOverview,
  type YouthMission,
} from "@/services/youth-development";

export const metadata: Metadata = {
  title: "Centre de formation",
  description:
    "Détectez, formez et préparez les futurs coureurs de votre équipe.",
};

type Tab = "scouting" | "ecole" | "development";
type PageProps = {
  searchParams: Promise<{
    onglet?: string;
    succes?: string;
    erreur?: string;
    didacticiel?: string;
    rapports?: string;
    dev?: string;
  }>;
};

export default async function YouthDevelopmentPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const activeTab: Tab =
    query.onglet === "ecole" || query.onglet === "development"
      ? query.onglet
      : "scouting";
  const activeDevelopmentView: DevelopmentTeamView =
    query.dev === "calendrier" ||
    query.dev === "resultats" ||
    query.dev === "maillot"
      ? query.dev
      : "effectif";
  const tutorialDemo =
    query.didacticiel === YOUTH_DEVELOPMENT_TUTORIAL_DEMO_VALUE;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  let overview: YouthDevelopmentOverview | null = null;
  let developmentOverview: DevelopmentTeamOverview | null = null;
  let loadingError: string | null = null;
  const headerPromise = getGameHeaderData(supabase, user.id);
  const tutorialProgressPromise = getAuthenticatedTutorialProgress(
    supabase,
    YOUTH_DEVELOPMENT_TUTORIAL_KEY,
  ).catch((tutorialError: unknown) => {
    console.error(
      "Impossible de reprendre le didacticiel du centre de formation :",
      tutorialError,
    );
    return null;
  });
  try {
    overview = await getYouthDevelopmentOverview(supabase, user.id);
  } catch (overviewError) {
    console.error(
      "Impossible de charger le centre de formation :",
      overviewError,
    );
    loadingError =
      overviewError instanceof Error
        ? overviewError.message
        : "Le centre de formation ne peut pas être chargé.";
  }
  if (activeTab === "development") {
    try {
      developmentOverview = await getDevelopmentTeamOverview(user.id);
    } catch (developmentError) {
      console.error(
        "Impossible de charger la Development Team :",
        developmentError,
      );
      loadingError =
        developmentError instanceof Error
          ? developmentError.message
          : "La Development Team ne peut pas être chargée.";
    }
  }
  const [headerData, youthDevelopmentTutorialProgress] = await Promise.all([
    headerPromise,
    tutorialProgressPromise,
  ]);
  const currentTutorialRoute = tutorialDemo
    ? activeTab === "ecole"
      ? YOUTH_DEVELOPMENT_ACADEMY_ROUTE
      : YOUTH_DEVELOPMENT_SCOUTING_ROUTE
    : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {youthDevelopmentTutorialProgress?.status === "in_progress" &&
      youthDevelopmentTutorialProgress.current_route === currentTutorialRoute &&
      youthDevelopmentTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={YOUTH_DEVELOPMENT_TUTORIAL_KEY}
          currentStepKey={youthDevelopmentTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />
      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-11">
        <BackToOfficeLink />

        <header
          data-tutorial-id="youth-development-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(130deg,#071A17_0%,#0B302B_52%,#176951_100%)] p-7 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:p-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[48px] border-[#F2C94C]/8"
          />
          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-black uppercase tracking-[0.21em] text-[#9BE0CA]">
                  Détection · apprentissage · relève
                </p>
                {overview?.unreadCount ? (
                  <span className="rounded-full bg-[#C63F3F] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                    {overview.unreadCount} nouveauté
                    {overview.unreadCount > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-[-0.045em] sm:text-6xl">
                  Centre de formation
                </h1>
                <TutorialLaunchButton
                  tutorialKey={YOUTH_DEVELOPMENT_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2] sm:text-base">
                Construisez un réseau mondial, repérez des profils bruts puis
                façonnez-les chaque jour avant leur passage chez les
                professionnels.
              </p>
            </div>
            {overview ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <HeroMetric
                  label="Scouts"
                  value={String(overview.scouts.length)}
                />
                <HeroMetric
                  label="Jeunes"
                  value={String(overview.academy.length)}
                />
                <HeroMetric
                  label="Jour"
                  value={`${overview.currentDayNumber}/28`}
                />
              </div>
            ) : null}
          </div>
        </header>

        <nav
          data-tutorial-id="youth-development-tabs"
          aria-label="Rubriques du centre de formation"
          className="mt-6 grid gap-2 rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-sm sm:grid-cols-3"
        >
          <TabLink
            tab="scouting"
            activeTab={activeTab}
            label="Scouting"
            detail="Carte & rapports"
            count={
              overview?.missions.filter((mission) => mission.unread).length
            }
            tutorialDemo={tutorialDemo}
          />
          <TabLink
            tab="ecole"
            activeTab={activeTab}
            label="École de cyclisme"
            detail="Effectif & entraînement"
            tutorialDemo={tutorialDemo}
          />
          <TabLink
            tab="development"
            activeTab={activeTab}
            label="Development Team"
            detail="Effectif & courses juniors"
            tutorialDemo={tutorialDemo}
          />
        </nav>

        <div className="mt-5 space-y-4">
          {query.succes ? <Alert tone="success">{query.succes}</Alert> : null}
          {query.erreur ? <Alert tone="error">{query.erreur}</Alert> : null}
          {loadingError ? <Alert tone="error">{loadingError}</Alert> : null}
        </div>

        {overview && activeTab === "scouting" ? (
          <ScoutingTab
            overview={overview}
            tutorialDemo={tutorialDemo}
            showReportHistory={!tutorialDemo && query.rapports === "historique"}
          />
        ) : null}
        {overview && activeTab === "ecole" ? (
          <AcademyTab overview={overview} tutorialDemo={tutorialDemo} />
        ) : null}
        {activeTab === "development" && developmentOverview ? (
          <DevelopmentTeamPanel
            overview={developmentOverview}
            activeView={activeDevelopmentView}
          />
        ) : null}
      </section>
    </main>
  );
}

function ScoutingTab({
  overview,
  tutorialDemo,
  showReportHistory,
}: {
  overview: YouthDevelopmentOverview;
  tutorialDemo: boolean;
  showReportHistory: boolean;
}) {
  const activeMissions = overview.missions.filter(
    (mission) => mission.status === "active",
  );
  const completedMissions = overview.missions.filter(
    (mission) => mission.status === "completed",
  );
  const now = new Date();
  const archivedMissions = completedMissions.filter((mission) =>
    isYouthScoutingMissionArchived(mission, now),
  );
  const recentMissions = completedMissions.filter(
    (mission) => !isYouthScoutingMissionArchived(mission, now),
  );
  const displayedMissions = showReportHistory
    ? archivedMissions
    : recentMissions;
  return (
    <div className="mt-7 space-y-8">
      <section aria-labelledby="scouts-title">
        <SectionHeading
          eyebrow="Cellule de recrutement"
          title="Vos scouts disponibles"
          id="scouts-title"
          description="Un scout ne peut couvrir qu’une zone à la fois. Son niveau améliore le potentiel et les statistiques initiales des jeunes détectés ; une nationalité commune avec le pays ciblé ajoute 15 % d’efficacité."
        />
        {overview.scouts.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {overview.scouts.map((scout) => (
              <article
                key={scout.contractId}
                className={`rounded-2xl border bg-white p-4 ${scout.activeMissionId ? "border-[#F2C94C]/60" : "border-[#315B3E]/12"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`fi fi-${scout.countryCode.toLowerCase()} h-5 w-7 rounded shadow-sm`}
                  />
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${scout.activeMissionId ? "bg-[#F2C94C]/20 text-[#8A6B16]" : "bg-[#72D4B7]/15 text-[#176951]"}`}
                  >
                    {scout.activeMissionId ? "En mission" : "Disponible"}
                  </span>
                </div>
                <h3 className="mt-3 font-black text-[#071A17]">
                  {scout.firstName} {scout.lastName}
                </h3>
                <p className="mt-1 text-xs font-bold text-[#60756E]">
                  {scout.countryName} · Niveau {scout.level}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aucun scout dans votre staff"
            text="Recrutez au moins un scout depuis la rubrique Staff pour lancer une mission."
          />
        )}
      </section>

      <section aria-label="Carte de scouting">
        <YouthScoutingMap
          countries={overview.countries}
          scouts={overview.scouts}
          tutorialMode={tutorialDemo}
        />
      </section>

      {tutorialDemo ? (
        <>
          <TutorialScoutingDeadlines />
          <TutorialScoutingReport currency={overview.currency} />
        </>
      ) : null}

      {activeMissions.length ? (
        <section>
          <SectionHeading eyebrow="Sur le terrain" title="Missions en cours" />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {activeMissions.map((mission) => (
              <ActiveMissionCard
                key={mission.id}
                mission={mission}
                currentDay={overview.currentDayNumber}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Rapports de détection"
            title={
              showReportHistory
                ? "Historique des rapports consultés"
                : "Talents repérés"
            }
            description={
              showReportHistory
                ? "Retrouvez les rapports traités : trois jours après consultation, ou dès que tous leurs jeunes ont été recrutés."
                : "Un rapport rejoint l’historique trois jours après consultation, ou immédiatement si tous ses jeunes sont recrutés."
            }
          />
          <Link
            href={
              showReportHistory
                ? "/jeu/centre-de-formation?onglet=scouting"
                : "/jeu/centre-de-formation?onglet=scouting&rapports=historique"
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#176951]/25 bg-white px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#176951] shadow-sm transition hover:border-[#176951]/50 hover:bg-[#EAF5F3]"
          >
            {showReportHistory
              ? "Revenir aux rapports récents"
              : "Historique des rapports consultés"}
            {!showReportHistory && archivedMissions.length > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#176951] px-1.5 text-[10px] text-white">
                {archivedMissions.length}
              </span>
            ) : null}
          </Link>
        </div>
        {displayedMissions.length ? (
          <div className="mt-4 space-y-5">
            {displayedMissions.map((mission) => (
              <MissionReport
                key={mission.id}
                mission={mission}
                currency={overview.currency}
                balance={overview.balance}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              showReportHistory
                ? "Aucun rapport dans l’historique"
                : "Aucun rapport récent"
            }
            text={
              showReportHistory
                ? "Les rapports consultés depuis trois jours et ceux dont tous les jeunes ont été recrutés apparaissent ici."
                : "Lancez une mission de 3 à 7 jours : un rapport contiendra entre 1 et 4 jeunes."
            }
          />
        )}
      </section>
    </div>
  );
}

const TUTORIAL_SCOUTING_REPORT: TransferScoutingReport = {
  overall: { kind: "range", minimum: 52, maximum: 56 },
  potential: { kind: "range", minimumSteps: 6, maximumSteps: 8 },
  ratings: {
    mountain: { kind: "range", minimum: 58, maximum: 64 },
    hills: { kind: "exact", value: 61 },
    flat: { kind: "range", minimum: 47, maximum: 53 },
    timeTrial: { kind: "unknown" },
    cobbles: { kind: "range", minimum: 42, maximum: 48 },
    sprint: { kind: "exact", value: 46 },
    acceleration: { kind: "range", minimum: 56, maximum: 61 },
    downhill: { kind: "unknown" },
    endurance: { kind: "range", minimum: 57, maximum: 63 },
    resistance: { kind: "exact", value: 60 },
    recovery: { kind: "range", minimum: 50, maximum: 56 },
    breakaway: { kind: "range", minimum: 54, maximum: 60 },
    prologue: { kind: "unknown" },
  },
};

function TutorialScoutingDeadlines() {
  return (
    <section
      data-tutorial-id="youth-tutorial-deadlines"
      className="overflow-hidden rounded-[1.75rem] border border-[#F2C94C]/45 bg-[#0B302B] p-5 text-white shadow-sm sm:p-6"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
            Exemple fictif · mission de trois jours
          </p>
          <h2 className="mt-2 text-2xl font-black">Départ J12 · rapport J15</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
            Le scout reste indisponible pendant toute la mission. Une mission
            réelle dure de 3 à 7 jours, doit se terminer avant le J28 et révèle
            entre 1 et 4 candidats.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <TutorialMetric label="Départ" value="J12" />
          <TutorialMetric label="Durée" value="3 j" />
          <TutorialMetric label="Retour" value="J15" />
        </div>
      </div>
    </section>
  );
}

function TutorialScoutingReport({ currency }: { currency: string }) {
  return (
    <section
      data-tutorial-id="youth-tutorial-report"
      className="rounded-[1.75rem] border border-[#C63F3F]/25 bg-white p-5 shadow-sm ring-2 ring-[#C63F3F]/5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Rapport de démonstration · Belgique
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#071A17]">
            Un talent fictif à analyser
          </h2>
        </div>
        <span className="rounded-full bg-[#FFF5D6] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#806114]">
          Aucune donnée réelle
        </span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(230px,0.55fr)_minmax(0,1.45fr)]">
        <div className="rounded-2xl border border-[#315B3E]/12 bg-[#FFFDF4] p-4">
          <div className="flex items-center gap-4">
            <RiderAvatar
              profileKey="tutorial-youth-climber"
              seed="centre-formation-tutorial"
              riderId="11111111-1111-4111-8111-111111111111"
              age={16}
              className="h-20 w-20"
            />
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">
                16 ans · Grimpeur / Puncheur
              </p>
              <h3 className="mt-1 text-xl font-black text-[#071A17]">
                Noah Vermeulen
              </h3>
              <p className="mt-1 text-xs font-bold text-[#278B70]">
                Profil prometteur, informations incomplètes
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#EAF5F3] p-3">
              <dt className="text-[9px] font-black uppercase text-[#60756E]">
                Prime d’accueil
              </dt>
              <dd className="mt-1 font-black text-[#071A17]">
                {formatCurrency(18_000, currency)}
              </dd>
            </div>
            <div className="rounded-xl bg-[#EAF5F3] p-3">
              <dt className="text-[9px] font-black uppercase text-[#60756E]">
                Scolarité
              </dt>
              <dd className="mt-1 font-black text-[#071A17]">
                {formatCurrency(7_500, currency)} / saison
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <TransferScoutingReportPanel
            report={TUTORIAL_SCOUTING_REPORT}
            compact
          />
          <div
            data-tutorial-id="youth-tutorial-signing"
            className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#F2C94C]/45 bg-[#FFF9E7] p-4"
          >
            <p className="max-w-xl text-xs font-bold leading-5 text-[#756B48]">
              La vraie signature débite la prime immédiatement puis ajoute les
              frais de scolarité. Ici, le passage vers l’école reste simulé.
            </p>
            <button
              type="button"
              disabled
              className="rounded-xl bg-[#F2C94C] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17] opacity-80"
            >
              Signer · simulation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AcademyTab({
  overview,
  tutorialDemo,
}: {
  overview: YouthDevelopmentOverview;
  tutorialDemo: boolean;
}) {
  const tutorialReferenceRider = overview.academy[0] ?? null;
  const tutorialGameType =
    tutorialReferenceRider?.manualTraining.gameType ?? "rhythm";
  const tutorialPriorityLabel = tutorialReferenceRider
    ? tutorialReferenceRider.trainingPriority === "rouleur"
      ? "CLM / Rouleur"
      : TRAINING_DOMAIN_LABELS[tutorialReferenceRider.trainingPriority]
    : "Grimpeur";
  const tutorialRiderName = tutorialReferenceRider
    ? `${tutorialReferenceRider.firstName} ${tutorialReferenceRider.lastName}`
    : "Noah Vermeulen";
  const nextSeasonPromotions = overview.academy.filter(
    (rider) =>
      rider.status === "recruited" &&
      rider.promotionGameYear === overview.gameYear + 1,
  );

  return (
    <div className="mt-7 space-y-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <SectionHeading
          eyebrow="Formation quotidienne"
          title="École de cyclisme"
          description="Choisissez à tout moment le mode des prochaines séances : automatique à 8 h avec un bonus ×2, ou deux minijeux manuels de minuit à midi et de midi à minuit. Le choix reste actif jusqu’à votre prochaine modification."
        />
        <div className="rounded-2xl border border-[#315B3E]/12 bg-white px-5 py-4 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
            Frais annuels récurrents
          </p>
          <p className="mt-1 text-2xl font-black text-[#071A17]">
            {formatCurrency(overview.totalTuitionPerSeason, overview.currency)}
          </p>
        </div>
      </div>
      {nextSeasonPromotions.length ? (
        <NextSeasonPromotions
          riders={nextSeasonPromotions}
          gameYear={overview.gameYear + 1}
        />
      ) : null}
      {tutorialDemo ? (
        <TutorialAcademyDemo
          gameType={tutorialGameType}
          priorityLabel={tutorialPriorityLabel}
          riderName={tutorialRiderName}
          automaticSelected={
            tutorialReferenceRider?.trainingModePreference === "automatic"
          }
        />
      ) : null}
      {!overview.canScheduleYouthPromotion ? (
        <Alert tone="error">
          Effectif de la saison prochaine complet :{" "}
          {overview.nextSeasonRosterCommitments} / {overview.rosterLimit} places
          sont déjà engagées. Libérez une place avant de programmer une nouvelle
          promotion.
        </Alert>
      ) : null}
      {overview.academy.length ? (
        <YouthTrainingBulkEditor
          initialSettings={overview.academy.map((rider) => ({
            academyRiderId: rider.id,
            trainingPriority: rider.trainingPriority,
            trainingMode: rider.trainingModePreference,
          }))}
        >
          <div className="space-y-3">
            {overview.academy.map((rider) => (
              <AcademyRiderCard
                key={rider.id}
                rider={rider}
                gameYear={overview.gameYear}
                currency={overview.currency}
                canSchedulePromotion={overview.canScheduleYouthPromotion}
                rosterLimit={overview.rosterLimit}
              />
            ))}
          </div>
        </YouthTrainingBulkEditor>
      ) : (
        <EmptyState
          title="Votre école est encore vide"
          text="Signez un jeune depuis un rapport de scouting pour commencer sa formation."
        />
      )}
    </div>
  );
}

function NextSeasonPromotions({
  riders,
  gameYear,
}: {
  riders: AcademyYouth[];
  gameYear: number;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#D6A93D]/30 bg-[#FFF9E5] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#806114]">
            Passage en équipe première
          </p>
          <h2 className="mt-1 text-lg font-black text-[#183F37]">
            Saison {gameYear}
          </h2>
        </div>
        <span className="rounded-full bg-[#F2C94C] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#071A17]">
          {riders.length} futur{riders.length > 1 ? "s" : ""} pro
          {riders.length > 1 ? "s" : ""}
        </span>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {riders.map((rider) => (
          <li
            key={rider.id}
            className="rounded-full border border-[#D6A93D]/25 bg-white px-3 py-2 text-xs font-black text-[#183F37]"
          >
            {rider.firstName} {rider.lastName}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TutorialAcademyDemo({
  gameType,
  priorityLabel,
  riderName,
  automaticSelected,
}: {
  gameType: YouthTrainingGameType;
  priorityLabel: string;
  riderName: string;
  automaticSelected: boolean;
}) {
  return (
    <section
      data-tutorial-id="youth-tutorial-academy"
      className="overflow-hidden rounded-[1.75rem] border border-[#278B70]/25 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#0B302B] px-5 py-5 text-white sm:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0CA]">
            École de démonstration
          </p>
          <h2 className="mt-1 text-2xl font-black">{riderName}</h2>
          <p className="mt-1 text-xs font-bold text-[#D6DFD2]">
            Aperçu adapté au profil travaillé · {priorityLabel}
          </p>
        </div>
        <span className="rounded-full bg-[#F2C94C] px-3 py-2 text-[9px] font-black uppercase text-[#071A17]">
          Simulation sans sauvegarde
        </span>
      </header>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] sm:p-6">
        <div
          data-tutorial-id="youth-tutorial-training-settings"
          className="rounded-2xl bg-[#EAF5F3] p-4"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            Modes disponibles
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TutorialTrainingMode
              active={automaticSelected}
              title="Automatique"
              detail="Tous les matins à 8 h · efficacité junior ×2"
            />
            <TutorialTrainingMode
              active={!automaticSelected}
              title="Manuel"
              detail="Deux créneaux · minuit–midi et midi–minuit"
            />
          </div>
          <div className="mt-4 rounded-xl border border-[#315B3E]/12 bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
              Profil actuellement illustré
            </p>
            <p className="mt-1 font-black text-[#071A17]">{priorityLabel}</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
              Ce profil détermine les statistiques travaillées et sélectionne
              automatiquement le type de minijeu manuel.
            </p>
          </div>
        </div>

        <div
          data-tutorial-id="youth-tutorial-minigame"
          className="rounded-2xl border border-[#F2C94C]/35 bg-[#FFFDF4] p-4"
        >
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#806114]">
            {YOUTH_TRAINING_GAME_LABELS[gameType]} · aperçu interactif
          </p>
          <YouthTrainingMiniGame
            academyRiderId="11111111-1111-4111-8111-111111111111"
            riderName={riderName}
            trainingMode="manual"
            gameType={gameType}
            currentSlotLabel="Créneau de démonstration"
            currentSlotCompleted={false}
            completedSlotCount={0}
            demoMode
          />
        </div>
      </div>
    </section>
  );
}

function TutorialTrainingMode({
  active,
  title,
  detail,
}: {
  active: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active
          ? "border-[#176951]/35 bg-white ring-2 ring-[#176951]/10"
          : "border-[#315B3E]/10 bg-white/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm text-[#071A17]">{title}</strong>
        {active ? (
          <span className="rounded-full bg-[#176951] px-2 py-1 text-[8px] font-black uppercase text-white">
            Réglage du DS
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
        {detail}
      </p>
    </div>
  );
}

function TutorialMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20 rounded-xl border border-white/15 bg-white/10 p-3">
      <span className="block text-[8px] font-black uppercase tracking-[0.12em] text-[#9BE0CA]">
        {label}
      </span>
      <strong className="mt-1 block text-lg text-white">{value}</strong>
    </div>
  );
}

function AcademyRiderCard({
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
  return (
    <article
      data-academy-rider-card
      className="overflow-hidden rounded-[1.5rem] border border-[#315B3E]/12 bg-white shadow-sm"
    >
      <div className="grid gap-3 p-4 xl:grid-cols-2 2xl:grid-cols-4">
        <div className="flex h-full items-center gap-3 rounded-2xl border border-[#315B3E]/10 bg-[#F8FBF9] p-3">
          <RiderAvatar
            profileKey={rider.profileKey}
            seed={rider.avatarSeed}
            riderId={rider.id}
            age={rider.age}
            className="h-16 w-16"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`fi fi-${rider.countryCode.toLowerCase()} h-4 w-6 rounded`}
              />
              <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">
                {rider.age} ans
              </span>
            </div>
            <h3 className="mt-1 text-lg font-black text-[#071A17]">
              {rider.firstName} {rider.lastName}
            </h3>
            <p className="mt-0.5 text-xs font-extrabold text-[#278B70]">
              {rider.sportingProfile}
            </p>
            <div className="mt-1.5">
              <PotentialStars potentialSteps={rider.potentialSteps} />
            </div>
          </div>
        </div>
        <div className="h-full rounded-2xl border border-[#315B3E]/10 bg-[#F8FBF9] p-3 2xl:col-span-2">
          <RatingsGrid ratings={rider.ratings} compact />
        </div>
        <div className="contents">
          <NaturalizationCard
            eligibility={rider.naturalization}
            subjectName={`${rider.firstName} ${rider.lastName}`}
            subjectId={rider.id}
            subjectIdField="academyRiderId"
            action={naturalizeYouthRiderAction}
            compact
          />
          <YouthTrainingSettingsFields
            academyRiderId={rider.id}
            pendingTrainingMode={rider.pendingTrainingMode}
          />
          <YouthTrainingMiniGame
            academyRiderId={rider.id}
            riderName={`${rider.firstName} ${rider.lastName}`}
            trainingMode={rider.trainingMode}
            gameType={rider.manualTraining.gameType}
            currentSlotLabel={rider.manualTraining.currentSlotLabel}
            currentSlotCompleted={rider.manualTraining.currentSlotCompleted}
            completedSlotCount={rider.manualTraining.completedSlotCount}
          />
          <YouthTrainingReports
            latestReport={rider.latestTrainingReport}
            seasonReport={rider.seasonTrainingReport}
          />
          <div
            data-academy-rider-footer
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-3 py-2.5 xl:col-span-2 2xl:col-span-4"
          >
            <p className="text-[10px] font-bold text-[#60756E]">
              Scolarité :{" "}
              <strong className="text-[#183F37]">
                {formatCurrency(rider.tuitionPerSeason, currency)} / saison
              </strong>
            </p>
            <div className="min-w-[220px] sm:max-w-sm sm:flex-1">
              {rider.status === "recruited" ? (
                <div className="rounded-xl bg-[#F2C94C]/20 px-3 py-2.5 text-xs font-black text-[#8A6B16]">
                  Passage pro la saison prochaine · {rider.promotionGameYear}
                </div>
              ) : rider.canRecruit ? (
                canSchedulePromotion ? (
                  <form action={recruitYouthRiderAction}>
                    <input
                      type="hidden"
                      name="academyRiderId"
                      value={rider.id}
                    />
                    <button className="w-full rounded-xl bg-[#F2C94C] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17]">
                      Recruter pour la saison {gameYear + 1}
                    </button>
                  </form>
                ) : (
                  <p className="rounded-xl bg-[#FFF0EE] px-3 py-2.5 text-[10px] font-bold text-[#8A2F2F]">
                    Promotion impossible · {rosterLimit} places déjà engagées.
                  </p>
                )
              ) : (
                <p className="rounded-xl bg-[#F6F7F2] px-3 py-2.5 text-[10px] font-bold text-[#60756E]">
                  Recrutable à partir de 17 ans.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
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
function MissionReport({
  mission,
  currency,
  balance,
}: {
  mission: YouthMission;
  currency: string;
  balance: number;
}) {
  const fullyRecruited = areAllYouthScoutingCandidatesRecruited(mission);

  return (
    <article
      className={`rounded-[1.75rem] border bg-white p-5 shadow-sm sm:p-6 ${mission.unread ? "border-[#C63F3F]/45 ring-2 ring-[#C63F3F]/8" : "border-[#315B3E]/12"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`fi fi-${mission.countryCode.toLowerCase()} h-7 w-10 rounded shadow-sm`}
          />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#278B70]">
              {mission.countryName} · {mission.durationDays} jour
              {mission.durationDays > 1 ? "s" : ""}
            </p>
            <h3 className="mt-1 text-xl font-black text-[#071A17]">
              Rapport de {mission.scoutName}
            </h3>
          </div>
        </div>
        {fullyRecruited ? (
          <span className="rounded-full bg-[#EAF5F3] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#176951]">
            Tous recrutés
          </span>
        ) : mission.unread ? (
          <form action={markYouthScoutingReportViewedAction}>
            <input type="hidden" name="missionId" value={mission.id} />
            <button className="rounded-xl border border-[#C63F3F]/30 bg-[#FFF7F5] px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#B54242]">
              Marquer comme consulté
            </button>
          </form>
        ) : (
          <span className="rounded-full bg-[#EAF5F3] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#176951]">
            Consulté
          </span>
        )}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {mission.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            currency={currency}
            balance={balance}
          />
        ))}
      </div>
    </article>
  );
}

function CandidateCard({
  candidate,
  currency,
  balance,
}: {
  candidate: YouthCandidate;
  currency: string;
  balance: number;
}) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/12 bg-[#FFFDF4] p-4">
      <div className="flex items-start gap-4">
        <RiderAvatar
          profileKey={candidate.profileKey}
          seed={candidate.avatarSeed}
          riderId={candidate.id}
          age={candidate.age}
          className="h-16 w-16"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                "fi fi-" +
                candidate.countryCode.toLowerCase() +
                " h-4 w-6 rounded"
              }
            />
            <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">
              {candidate.age} ans · {candidate.archetypeLabel}
            </span>
          </div>
          <h4 className="mt-1 text-lg font-black text-[#071A17]">
            {candidate.firstName} {candidate.lastName}
          </h4>
          <p className="mt-1 text-xs font-extrabold text-[#278B70]">
            {candidate.sportingProfile}
          </p>
          {candidate.internationalCenterBonusPercentage > 0 ? (
            <p className="mt-2 inline-flex rounded-full bg-[#F2C94C]/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#8A6714]">
              Centre international mobilisé · potentiel estimé
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <TransferScoutingReportPanel
          report={candidate.scoutingReport}
          compact
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#315B3E]/10 pt-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">
            Prime d’accueil
          </p>
          <p className="font-black text-[#071A17]">
            {formatCurrency(candidate.signingFee, currency)}
          </p>
          <p className="text-[9px] font-bold text-[#60756E]">
            + {formatCurrency(candidate.tuitionPerSeason, currency)} / saison
          </p>
        </div>
        {candidate.status === "spotted" ? (
          <form action={signYouthCandidateAction}>
            <input type="hidden" name="candidateId" value={candidate.id} />
            <button
              disabled={balance < candidate.signingFee}
              className="rounded-xl bg-[#F2C94C] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#D5D6CE]"
            >
              Signer le jeune
            </button>
          </form>
        ) : (
          <span className="rounded-full bg-[#72D4B7]/15 px-3 py-2 text-[9px] font-black uppercase text-[#176951]">
            À l’école
          </span>
        )}
      </div>
    </div>
  );
}

function RatingsGrid({
  ratings,
  compact = false,
}: {
  ratings: Record<RiderRatingKey, number>;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-1.5 ${compact ? "grid-cols-7" : "grid-cols-5"}`}>
      {RIDER_RATING_AXES.map((axis) => (
        <div
          key={axis.key}
          title={axis.label}
          data-rating-importance={axis.importance}
          className={[
            "rounded-lg border px-1 py-1.5 text-center",
            axis.importance === "primary"
              ? "border-[#278B70]/18 bg-white shadow-sm"
              : "border-[#315B3E]/8 bg-[#F1F5F3]",
          ].join(" ")}
        >
          <span
            className={
              axis.importance === "primary"
                ? "block text-[8px] font-black uppercase text-[#48665F]"
                : "block text-[8px] font-bold uppercase text-[#91A098]"
            }
          >
            {axis.shortLabel}
          </span>
          <strong
            className={
              axis.importance === "primary"
                ? "mt-0.5 block text-xs text-[#071A17]"
                : "mt-0.5 block text-xs font-bold text-[#71837D]"
            }
          >
            {ratings[axis.key].toFixed(1)}
          </strong>
        </div>
      ))}
    </div>
  );
}
function ActiveMissionCard({
  mission,
  currentDay,
}: {
  mission: YouthMission;
  currentDay: number;
}) {
  const progress = Math.min(
    100,
    Math.max(
      4,
      ((currentDay - mission.startDayNumber) / mission.durationDays) * 100,
    ),
  );
  return (
    <article className="rounded-2xl border border-[#F2C94C]/45 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8A6B16]">
            {mission.countryName}
          </p>
          <h3 className="mt-1 font-black text-[#071A17]">
            {mission.scoutName}
          </h3>
        </div>
        <span className="rounded-full bg-[#F2C94C]/20 px-3 py-1 text-[9px] font-black text-[#8A6B16]">
          Retour J{mission.completesDayNumber}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#315B3E]/10">
        <div
          className="h-full rounded-full bg-[#F2C94C]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </article>
  );
}

function TabLink({
  tab,
  activeTab,
  label,
  detail,
  count,
  tutorialDemo,
}: {
  tab: Tab;
  activeTab: Tab;
  label: string;
  detail: string;
  count?: number;
  tutorialDemo: boolean;
}) {
  const active = tab === activeTab;
  const href = tutorialDemo
    ? `/jeu/centre-de-formation?didacticiel=${YOUTH_DEVELOPMENT_TUTORIAL_DEMO_VALUE}&onglet=${tab}`
    : `/jeu/centre-de-formation?onglet=${tab}`;

  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition ${
        active
          ? "bg-[#0B302B] text-white shadow-md"
          : "text-[#315B3E] hover:bg-[#EAF5F3]"
      }`}
    >
      <span>
        <strong className="block text-sm">{label}</strong>
        <span
          className={`mt-0.5 block text-[10px] font-bold ${
            active ? "text-[#9BE0CA]" : "text-[#60756E]"
          }`}
        >
          {detail}
        </span>
      </span>
      {count ? (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C63F3F] px-1.5 text-[10px] font-black text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20 rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur-sm">
      <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-[#9BE0CA]">
        {label}
      </span>
      <strong className="mt-1 block text-xl text-white">{value}</strong>
    </div>
  );
}
function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  id?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071A17]"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[#315B3E]/25 bg-white/60 p-7 text-center">
      <p className="font-black text-[#071A17]">{title}</p>
      <p className="mt-2 text-sm font-semibold text-[#60756E]">{text}</p>
    </div>
  );
}
function Alert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-bold ${tone === "success" ? "border-[#278B70]/30 bg-[#DDF2E9] text-[#176951]" : "border-[#C63F3F]/30 bg-[#FFF0ED] text-[#A32F2F]"}`}
    >
      {children}
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
