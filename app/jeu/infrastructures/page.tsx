import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { markInfrastructureNotificationsReadAction } from "@/app/jeu/infrastructures/actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { DataRoomConstructionCard } from "@/components/game/data-room-construction-card";
import { GameHeader } from "@/components/game/game-header";
import { InfrastructureBuildingCard } from "@/components/game/infrastructure-building-card";
import { InternationalYouthCenterMap } from "@/components/game/international-youth-center-map";
import { StaffAcademyCard } from "@/components/game/staff-academy-card";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import Link from "@/components/ui/app-link";
import {
  INFRASTRUCTURE_UNLOCK_LEVEL,
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  getTeamInfrastructureCodesByStartingCost,
  getTeamInfrastructureLevelDefinition,
} from "@/lib/game/infrastructure";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
  INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE,
  INFRASTRUCTURE_TUTORIAL_KEY,
} from "@/lib/tutorial/infrastructure";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { getGameHeaderData } from "@/services/game-header-data";
import { getStaffAcademyOverview } from "@/services/staff-academy";
import {
  getTeamInfrastructureOverview,
  type InfrastructureProject,
} from "@/services/team-infrastructures";

export const metadata: Metadata = {
  title: "Infrastructures de l’équipe",
  description:
    "Construisez des bâtiments durables et développez le réseau mondial de formation.",
};

type Tab = "batiments" | "international";
type PageProps = {
  searchParams: Promise<{
    onglet?: string;
    succes?: string;
    erreur?: string;
  }>;
};

const infrastructureCodesByStartingCost =
  getTeamInfrastructureCodesByStartingCost();

export default async function InfrastructuresPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const activeTab: Tab =
    query.onglet === "international" ? "international" : "batiments";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const [headerData, overview, academy, infrastructureTutorialProgress] =
    await Promise.all([
      getGameHeaderData(supabase, user.id),
      getTeamInfrastructureOverview(supabase, user.id),
      getStaffAcademyOverview(supabase, user.id),
      getAuthenticatedTutorialProgress(
        supabase,
        INFRASTRUCTURE_TUTORIAL_KEY,
      ).catch((error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel des infrastructures :",
          error,
        );
        return null;
      }),
    ]);
  if (!overview || !academy) redirect("/jeu");

  const unlockProgress = Math.min(
    100,
    (overview.directorLevel / INFRASTRUCTURE_UNLOCK_LEVEL) * 100,
  );
  const currentInfrastructureTutorialRoute =
    activeTab === "international"
      ? INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE
      : INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {infrastructureTutorialProgress?.status === "in_progress" &&
      infrastructureTutorialProgress.current_route ===
        currentInfrastructureTutorialRoute &&
      infrastructureTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={INFRASTRUCTURE_TUTORIAL_KEY}
          currentStepKey={infrastructureTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header
          data-tutorial-id="infrastructure-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_48%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:px-10 sm:py-11"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:32px_32px]"
          />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] xl:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Direction technique · Investissements durables
              </p>
              <div className="mt-4 flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                  Infrastructures
                </h1>
                <TutorialLaunchButton
                  tutorialKey={INFRASTRUCTURE_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2] sm:text-base">
                Engagez une part majeure de la trésorerie dans des bâtiments qui
                suivent l’équipe au fil des saisons. Le talent « Double
                chantier » d’un architecte 3★ ou plus permet de mener deux
                constructions simultanément lorsqu’il participe à l’une d’elles.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <HeroMetric
                  label="Trésorerie"
                  value={formatMoney(overview.balance, overview.currency)}
                />
                <HeroMetric
                  label="Architectes"
                  value={String(overview.architects.length)}
                />
                <HeroMetric
                  label="Chantier"
                  value={
                    overview.activeProjects.length
                      ? `${overview.activeProjects.length} en cours`
                      : "Disponible"
                  }
                />
                <HeroMetric
                  label="Académie"
                  value={
                    academy.academyLevel
                      ? `Niveau ${academy.academyLevel}`
                      : "À construire"
                  }
                />
              </div>
            </div>
            <div
              data-tutorial-id="infrastructure-access"
              className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">
                    Seuil d’accès
                  </p>
                  <p className="mt-2 text-3xl font-black text-[#F2C94C]">
                    Niveau {INFRASTRUCTURE_UNLOCK_LEVEL}
                  </p>
                </div>
                <span className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black">
                  N{overview.directorLevel}
                </span>
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#42B99A,#F2C94C)]"
                  style={{ width: `${unlockProgress}%` }}
                />
              </div>
              <p className="mt-3 text-xs font-bold text-[#BFD1C6]">
                {overview.isUnlocked
                  ? "Accès débloqué"
                  : `Encore ${
                      INFRASTRUCTURE_UNLOCK_LEVEL - overview.directorLevel
                    } niveau(x) à atteindre`}
              </p>
            </div>
          </div>
        </header>

        {query.succes ? <Notice tone="success">{query.succes}</Notice> : null}
        {query.erreur ? <Notice tone="error">{query.erreur}</Notice> : null}

        {overview.notifications.length ? (
          <section className="mt-6 rounded-[1.5rem] border border-[#278B70]/20 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                  Livraisons récentes
                </p>
                <h2 className="mt-1 text-xl font-black text-[#071A17]">
                  Actualité des chantiers
                </h2>
              </div>
              {overview.notifications.some(
                (notification) => notification.unread,
              ) ? (
                <form action={markInfrastructureNotificationsReadAction}>
                  <button className="rounded-xl border border-[#278B70]/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#176951]">
                    Tout marquer comme lu
                  </button>
                </form>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {overview.notifications.slice(0, 4).map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-4 ${
                    notification.unread
                      ? "border-[#F2C94C]/50 bg-[#FFF9E5]"
                      : "border-[#315B3E]/10 bg-[#F6F8F6]"
                  }`}
                >
                  <p className="font-black text-[#071A17]">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
                    {notification.message}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div data-tutorial-id="infrastructure-construction-status">
          {overview.activeProjects.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {overview.activeProjects.map((project) => (
                <ActiveProjectCard
                  key={project.id}
                  project={project}
                  currency={overview.currency}
                />
              ))}
            </div>
          ) : (
            <section className="mt-6 rounded-[1.5rem] border border-[#315B3E]/12 bg-white px-5 py-4">
              <p className="text-sm font-black text-[#176951]">
                Aucun chantier actif · une nouvelle construction peut être
                lancée.
              </p>
            </section>
          )}
        </div>

        <nav
          data-tutorial-id="infrastructure-tabs"
          aria-label="Rubriques des infrastructures"
          className="mt-7 grid gap-2 rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-sm sm:grid-cols-2"
        >
          <TabLink
            tab="batiments"
            activeTab={activeTab}
            label="Bâtiments de l’équipe"
            detail="Performance, Fan Club, recrutement et staff"
          />
          <TabLink
            tab="international"
            activeTab={activeTab}
            label="École internationale"
            detail="Centres mondiaux partagés entre tous les DS"
          />
        </nav>

        {activeTab === "batiments" ? (
          <div className="mt-7 space-y-8">
            <section>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
                Performance et communauté
              </p>
              <h2 className="mt-2 text-3xl font-black text-[#183F37]">
                Les bâtiments structurants du club
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
                Les bâtiments sont classés par prix d’entrée : des premiers
                équipements accessibles jusqu’aux pôles experts réservés aux
                structures les plus solides.
              </p>
              <div
                className="mt-5 space-y-5"
                data-building-order="starting-cost-ascending"
              >
                {infrastructureCodesByStartingCost.map((code) => {
                  const definition = TEAM_INFRASTRUCTURE_DEFINITIONS[code];
                  const currentLevel = overview.infrastructureLevels[code];

                  if (code === "recruitment_data_room") {
                    return (
                      <div
                        key={code}
                        data-building-code={code}
                        data-starting-cost={definition.levels[0]?.cost}
                        data-tutorial-id="infrastructure-data-room"
                      >
                        <DataRoomConstructionCard
                          currentLevel={overview.dataRoomLevel}
                          nextLevel={overview.dataRoomNextLevel}
                          architects={overview.architects}
                          activeProjects={overview.activeProjects}
                          isUnlocked={overview.isUnlocked}
                          balance={overview.balance}
                          currency={overview.currency}
                        />
                      </div>
                    );
                  }

                  if (code === "staff_academy") {
                    return (
                      <div
                        key={code}
                        data-building-code={code}
                        data-starting-cost={definition.levels[0]?.cost}
                        data-tutorial-id="infrastructure-staff-academy"
                      >
                        <StaffAcademyCard
                          academy={academy}
                          architects={overview.architects}
                          activeProjects={overview.activeProjects}
                          directorLevel={overview.directorLevel}
                          balance={overview.balance}
                          currency={overview.currency}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={code}
                      data-building-code={code}
                      data-starting-cost={definition.levels[0]?.cost}
                    >
                      <InfrastructureBuildingCard
                        definition={definition}
                        currentLevel={currentLevel}
                        nextLevel={getTeamInfrastructureLevelDefinition(
                          code,
                          currentLevel + 1,
                        )}
                        architects={overview.architects}
                        activeProjects={overview.activeProjects}
                        isUnlocked={overview.isUnlocked}
                        balance={overview.balance}
                        currency={overview.currency}
                        prerequisiteMessage={
                          code === "club_shop" &&
                          overview.infrastructureLevels.fan_club_headquarters <
                            1
                            ? "Construisez d’abord le siège social du Fan Club."
                            : null
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-7">
            <div
              data-tutorial-id="infrastructure-school-effect"
              className="mb-5 rounded-2xl border border-[#F2C94C]/35 bg-[#FFF9E5] p-5"
            >
              <p className="font-black text-[#71580A]">
                Un effet mondial, financé par les équipes
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#7B6B37]">
                Chaque étoile de centre ajoute 10 points de probabilité de
                gagner une étoile entière de potentiel lors d’une détection dans
                le pays. Les étoiles de toutes les équipes se cumulent, avec un
                plafond mondial de 90 %.
              </p>
            </div>
            <div data-tutorial-id="infrastructure-school-map">
              <InternationalYouthCenterMap
                countries={overview.countries}
                architects={overview.architects}
                activeProjects={overview.activeProjects}
                isUnlocked={overview.isUnlocked}
                balance={overview.balance}
                currency={overview.currency}
              />
            </div>
          </div>
        )}

        {overview.recentProjects.length ? (
          <section className="mt-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
              Historique
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Chantiers livrés
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {overview.recentProjects.slice(0, 6).map((project) => (
                <div
                  key={project.id}
                  className="rounded-2xl border border-[#315B3E]/12 bg-white p-4"
                >
                  <p className="font-black text-[#071A17]">
                    {project.name}
                    {project.countryName ? ` · ${project.countryName}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#60756E]">
                    Niveau {project.targetLevel} ·{" "}
                    {formatMoney(project.finalCost, overview.currency)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function ActiveProjectCard({
  project,
  currency,
}: {
  project: InfrastructureProject;
  currency: string;
}) {
  const progress = Math.max(
    4,
    Math.min(
      100,
      ((project.finalDurationDays - project.remainingDays) /
        project.finalDurationDays) *
        100,
    ),
  );
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[#F2C94C]/40 bg-white shadow-sm">
      <div className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B07C11]">
            Chantier actif
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#071A17]">
            {project.name}
            {project.countryName ? ` · ${project.countryName}` : ""}
          </h2>
          <p className="mt-2 text-sm font-semibold text-[#60756E]">
            Niveau {project.targetLevel} · livraison prévue en saison{" "}
            {project.completionGameYear}, J{project.completionDayNumber} ·{" "}
            {formatMoney(project.finalCost, currency)}
          </p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#E3E9E6]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#278B70,#F2C94C)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-[#0B302B] px-6 py-4 text-center text-white">
          <p className="text-3xl font-black text-[#F2C94C]">
            {project.remainingDays}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#BFD1C6]">
            jours restants
          </p>
        </div>
      </div>
    </section>
  );
}

function TabLink({
  tab,
  activeTab,
  label,
  detail,
}: {
  tab: Tab;
  activeTab: Tab;
  label: string;
  detail: string;
}) {
  const active = tab === activeTab;
  return (
    <Link
      href={`/jeu/infrastructures?onglet=${tab}`}
      className={`rounded-xl px-4 py-3 transition ${
        active
          ? "bg-[#0B302B] text-white shadow-md"
          : "text-[#315B3E] hover:bg-[#EAF5F3]"
      }`}
    >
      <strong className="block text-sm">{label}</strong>
      <span
        className={`mt-0.5 block text-[10px] font-bold ${
          active ? "text-[#9BE0CA]" : "text-[#60756E]"
        }`}
      >
        {detail}
      </span>
    </Link>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-5 rounded-xl border px-5 py-4 text-sm font-bold ${
        tone === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-red-300 bg-red-50 text-red-900"
      }`}
    >
      {children}
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
