import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ObjectivesClaimProvider, ObjectivesHeroMetrics, ObjectivesPanel, ObjectivesTabLink } from "@/components/game/objectives-panel";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { DailyRewardsPanel } from "@/components/game/daily-rewards-panel";
import { GameHeader } from "@/components/game/game-header";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { TrophyGallery } from "@/components/game/trophy-gallery";
import { DAILY_REWARD_CYCLE_LENGTH } from "@/lib/game/daily-rewards";
import { buildObjectivesReturnPath } from "@/lib/game/filtered-page-paths";
import {
  parseGameObjectiveStatusFilter,
  parseGameObjectiveTypeFilter,
} from "@/lib/game/objectives";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentCycloStickersRewardObjectives,
  getCurrentGameObjectives,
  type RewardsPageObjective,
} from "@/services/game-objectives";
import { getCurrentDailyRewardOverview } from "@/services/daily-rewards";
import { getSportingDirectorTrophyGallery } from "@/services/trophy-gallery";

export const metadata: Metadata = {
  title: "Récompenses & trophées",
  description:
    "Suivez vos objectifs, récupérez vos récompenses et exposez les trophées de votre carrière de Directeur Sportif.",
};

type ObjectivesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ObjectivesPage({
  searchParams,
}: ObjectivesPageProps) {
  const query = await searchParams;
  const requestedTab = readQuery(query.onglet);
  const selectedTab =
    requestedTab === "trophees" || requestedTab === "quotidiennes"
      ? requestedTab
      : "objectifs";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, careerObjectives, trophyGallery, dailyRewards, albumObjectives] =
    await Promise.all([
      getGameHeaderData(supabase, user.id),
      selectedTab === "objectifs" ? getCurrentGameObjectives(supabase) : Promise.resolve([]),
      selectedTab === "trophees" ? getSportingDirectorTrophyGallery(user.id) : Promise.resolve(null),
      selectedTab === "quotidiennes" ? getCurrentDailyRewardOverview(supabase) : Promise.resolve(null),
      getCurrentCycloStickersRewardObjectives(supabase),
    ]);
  const objectives: RewardsPageObjective[] = selectedTab === "objectifs"
    ? [...careerObjectives, ...albumObjectives].sort((left, right) =>
        Number(right.completed && !right.claimedAt) - Number(left.completed && !left.claimedAt),
      )
    : [];

  const availableGroups = Array.from(
    new Set(objectives.map((objective) => objective.group)),
  );
  const requestedGroup = readQuery(query.groupe);
  const selectedGroup =
    requestedGroup && availableGroups.includes(requestedGroup)
      ? requestedGroup
      : "all";
  const selectedType = parseGameObjectiveTypeFilter(readQuery(query.type));
  const selectedStatus = parseGameObjectiveStatusFilter(
    readQuery(query.statut),
  );
  const success = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);
  const returnPath = buildObjectivesReturnPath({
    type: selectedType,
    status: selectedStatus,
    group: selectedGroup,
  });

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
        maxWidth="wide"
      />

      <ObjectivesClaimProvider initialObjectives={[...careerObjectives, ...albumObjectives]} ownerUserId={user.id} key={user.id + ":" + selectedTab + ":" + returnPath}>
      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_52%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-28 h-96 w-96 rounded-full border-[64px] border-white/5"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-1 w-full bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]"
          />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Carrière du Directeur Sportif
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Récompenses & trophées
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Progressez grâce aux objectifs, puis retrouvez dans votre
                galerie chaque victoire majeure et chaque titre UCI inscrit à
                votre palmarès officiel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:grid-cols-3 xl:grid-cols-2">
              {selectedTab === "objectifs" ? <ObjectivesHeroMetrics /> : null}
              {trophyGallery ? <HeroMetric
                label="Trophées"
                value={String(trophyGallery.counts.total)}
                highlight={trophyGallery.counts.total > 0}
              /> : null}
              {selectedTab === "quotidiennes" ? <HeroMetric label="Cycle quotidien" value={`${dailyRewards?.consecutiveDays ?? 0}/${DAILY_REWARD_CYCLE_LENGTH}`} /> : null}
            </div>
          </div>
        </header>

        <GameSectionTabs
          ariaLabel="Rubriques des récompenses"
          columns={3}
          className="mt-7"
        >
          <ObjectivesTabLink active={selectedTab === "objectifs"} />
          <GameSectionTabLink
            href="/jeu/objectifs?onglet=quotidiennes"
            label="Récompenses quotidiennes"
            description={
              dailyRewards?.availableToday
                ? "Cadeau du jour à ouvrir"
                : dailyRewards ? `Cycle ${dailyRewards.consecutiveDays}/${DAILY_REWARD_CYCLE_LENGTH}` : "Votre cadeau quotidien"
            }
            active={selectedTab === "quotidiennes"}
          />
          <GameSectionTabLink
            href="/jeu/objectifs?onglet=trophees"
            label="Galerie des trophées"
            description={
              trophyGallery ? trophyGallery.claimableTrophies.length > 0
                ? `${trophyGallery.claimableTrophies.length} cadeau à ouvrir`
                : `${trophyGallery.counts.total} pièce${trophyGallery.counts.total > 1 ? "s" : ""} au palmarès` : "Votre palmarès et vos distinctions"
            }
            active={selectedTab === "trophees"}
          />
        </GameSectionTabs>

        {selectedTab === "objectifs" ? (
          <ObjectivesPanel filters={{type: selectedType, status: selectedStatus, group: selectedGroup}} returnPath={returnPath} success={success} errorMessage={errorMessage} />
        ) : selectedTab === "quotidiennes" ? (
          <>
            {success ? <Notice tone="success">{success}</Notice> : null}
            {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}
            <DailyRewardsPanel overview={dailyRewards} />
          </>
        ) : (
          trophyGallery ? <TrophyGallery gallery={trophyGallery} focusedSource={readQuery(query.trophee) ?? undefined} acknowledgeNotifications /> : null
        )}
      </section>
      </ObjectivesClaimProvider>
    </main>
  );
}

function HeroMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-24 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#BFD1C6]">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-black ${highlight ? "text-[#F2C94C]" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${
        tone === "success"
          ? "border-[#42B99A]/35 bg-[#DDF3E7] text-[#176951]"
          : "border-[#C75348]/25 bg-[#FFF0EE] text-[#9C352D]"
      }`}
    >
      {children}
    </div>
  );
}

function readQuery(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}
