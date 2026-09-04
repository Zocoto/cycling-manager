import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { NationalFederationView } from "@/components/game/national-federation-view";
import Link from "@/components/ui/app-link";
import { buildFederationObjectives } from "@/lib/game/federation-objectives";
import {
  FEDERATION_MANAGEMENT_START_GAME_YEAR,
  parseNationalFederationTab,
} from "@/lib/game/national-federations";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getFederationChatOverview } from "@/services/federation-chat";
import { getFederationCoursesState } from "@/services/federation-courses";
import { getFederationFinanceBaseline } from "@/services/federation-finances";
import { getFederationObjectiveMetrics } from "@/services/federation-objectives";
import { getFederationRaceCreationState } from "@/services/federation-race-creation";
import { getFederationGovernanceOverview } from "@/services/federation-governance";
import { getFederationInternationalResults } from "@/services/federation-international-results";
import { getFederationInfrastructureState } from "@/services/federation-infrastructures";
import { getFederationSelectionPool } from "@/services/federation-selection-pool";
import { getFederationSelectionState } from "@/services/federation-selections";
import { getFederationTreasuryState } from "@/services/federation-treasury";
import { getFederationTeamJerseyArtworks } from "@/services/federation-team-jerseys";
import { getNationalFederationJersey } from "@/services/national-federation-jerseys";
import { getNationalFederationSnapshot } from "@/services/national-federations";
import { getPublicCountryDirectory } from "@/services/public-directory";
import { getNationRankingEntry } from "@/services/uci-rankings";

export const metadata: Metadata = {
  title: "Fédération nationale",
  description:
    "Découvrez la fédération nationale, ses équipes affiliées, ses champions et ses futurs outils collectifs.",
};

type FederationPageProps = {
  params: Promise<{ codePays: string }>;
  searchParams: Promise<{ onglet?: string | string[] }>;
};

export default async function FederationPage({
  params,
  searchParams,
}: FederationPageProps) {
  const [{ codePays }, query] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [directory, headerData, nationRanking] = await Promise.all([
    getPublicCountryDirectory(supabase, codePays),
    getGameHeaderData(supabase, user.id),
    getNationRankingEntry(codePays),
  ]);

  if (!directory) notFound();

  const country = directory.country;
  const selectedTab = parseNationalFederationTab(query.onglet);
  const snapshot = await getNationalFederationSnapshot({
    countryId: country.entity_id,
    countryCode: country.country_code,
    viewerTeamId: headerData.teamId,
  });
  const [
    publishedJersey,
    federationChat,
    financeBaseline,
    selectionRiders,
    internationalResults,
    governanceOverview,
    coursesState,
    selectionState,
    treasuryState,
    infrastructureState,
    objectiveMetrics,
    memberTeamJerseys,
  ] = await Promise.all([
    selectedTab === "governance"
      ? getNationalFederationJersey(supabase, country.entity_id)
      : Promise.resolve(null),
    selectedTab === "lounge" && snapshot.viewer.isAffiliated
      ? getFederationChatOverview(supabase, country.entity_id)
      : Promise.resolve(null),
    selectedTab === "finances"
      ? getFederationFinanceBaseline({
          countryId: country.entity_id,
          season: snapshot.season,
          teams: directory.members.teams.map((team) => ({
            id: team.entity_id,
            name: team.display_name,
          })),
        })
      : Promise.resolve(null),
    selectedTab === "selections"
      ? getFederationSelectionPool({
          countryId: country.entity_id,
          seasonId: snapshot.season.id,
          gameYear: snapshot.season.gameYear,
        }).catch((error) => {
          console.error(
            "Impossible de charger le vivier de sélection fédérale :",
            error,
          );
          return [];
        })
      : Promise.resolve([]),
    selectedTab === "overview" || selectedTab === "races"
      ? getFederationInternationalResults(country.entity_id)
      : Promise.resolve(null),
    selectedTab === "governance"
      ? getFederationGovernanceOverview({
          countryId: country.entity_id,
          season: snapshot.season,
          viewerTeamId: snapshot.viewer.isAffiliated
            ? snapshot.viewer.teamId
            : null,
        })
      : Promise.resolve(null),
    selectedTab === "races"
      ? getFederationCoursesState({
          countryId: country.entity_id,
          seasonId: snapshot.season.id,
          gameYear: snapshot.season.gameYear,
          currentDayNumber: snapshot.season.currentDayNumber,
          viewerTeamId: snapshot.viewer.isAffiliated
            ? snapshot.viewer.teamId
            : null,
        })
      : Promise.resolve(null),
    selectedTab === "selections"
      ? getFederationSelectionState({
          countryId: country.entity_id,
          seasonId: snapshot.season.id,
          gameYear: snapshot.season.gameYear,
          viewerTeamId: snapshot.viewer.teamId,
        })
      : Promise.resolve(null),
    selectedTab === "finances"
      ? getFederationTreasuryState({
          countryId: country.entity_id,
          seasonId: snapshot.season.id,
          gameYear: snapshot.season.gameYear,
          viewerTeamId: snapshot.viewer.teamId,
        })
      : Promise.resolve(null),
    selectedTab === "infrastructures"
      ? getFederationInfrastructureState({
          countryId: country.entity_id,
          seasonId: snapshot.season.id,
          gameYear: snapshot.season.gameYear,
          currentDayNumber: snapshot.season.currentDayNumber,
          viewerTeamId: snapshot.viewer.isAffiliated
            ? snapshot.viewer.teamId
            : null,
        })
      : Promise.resolve(null),
    selectedTab === "overview" || selectedTab === "races"
      ? getFederationObjectiveMetrics({
          countryId: country.entity_id,
          countryCode: country.country_code,
          seasonId: snapshot.season.id,
          gameYear: snapshot.season.gameYear,
          currentMemberTeamCount: country.team_count ?? 0,
        })
      : Promise.resolve(null),
    selectedTab === "overview"
      ? getFederationTeamJerseyArtworks(
          directory.members.teams.map((team) => team.entity_id),
        ).catch((error) => {
          console.error("Impossible de charger les maillots affiliés :", error);
          return {};
        })
      : Promise.resolve({}),
  ]);

  const federationRaceCreationState =
    selectedTab === "races"
      ? await getFederationRaceCreationState({
          countryId: country.entity_id,
          seasonId: snapshot.season.id,
          gameYear: snapshot.season.gameYear,
          viewerTeamId: snapshot.viewer.isAffiliated
            ? snapshot.viewer.teamId
            : null,
          nationRank: nationRanking?.rank ?? null,
          completedObjectiveCount: buildFederationObjectives({
            gameYear: Math.max(
              FEDERATION_MANAGEMENT_START_GAME_YEAR,
              snapshot.season.gameYear,
            ),
            nationRank: nationRanking?.rank ?? null,
            referenceMemberTeamCount:
              objectiveMetrics?.referenceMemberTeamCount ??
              (country.team_count ?? 0),
            currentMemberTeamCount: country.team_count ?? 0,
            naturalizationCount: objectiveMetrics?.naturalizationCount ?? 0,
            publishedSelectionCount:
              objectiveMetrics?.publishedSelectionCount ?? 0,
            nationsCupRank: objectiveMetrics?.nationsCupRank ?? null,
            worldRank: internationalResults?.world?.rank ?? null,
            continentalRank: internationalResults?.continental?.rank ?? null,
          }).filter((objective) => objective.completed).length,
        })
      : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToOfficeLink />
          <Link
            href={`/jeu/nations/${country.country_code.toLowerCase()}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white/85 px-4 text-xs font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
          >
            Voir la fiche de la nation
          </Link>
        </div>

        <NationalFederationView
          country={{
            id: country.entity_id,
            code: country.country_code,
            name: country.country_name,
          }}
          snapshot={snapshot}
          nationRanking={nationRanking}
          memberTeams={directory.members.teams}
          memberTeamCount={country.team_count ?? 0}
          selectedTab={selectedTab}
          publishedJersey={publishedJersey}
          federationChat={federationChat}
          financeBaseline={financeBaseline}
          selectionRiders={selectionRiders}
          internationalResults={internationalResults}
          governanceOverview={governanceOverview}
          coursesState={coursesState}
          raceCreationState={federationRaceCreationState}
          selectionState={selectionState}
          treasuryState={treasuryState}
          infrastructureState={infrastructureState}
          objectiveMetrics={objectiveMetrics}
          memberTeamJerseys={memberTeamJerseys}
        />
      </section>
    </main>
  );
}
