import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { NationalFederationView } from "@/components/game/national-federation-view";
import Link from "@/components/ui/app-link";
import { parseNationalFederationTab } from "@/lib/game/national-federations";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getFederationChatOverview } from "@/services/federation-chat";
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
  const [publishedJersey, federationChat] = await Promise.all([
    selectedTab === "governance"
      ? getNationalFederationJersey(supabase, country.entity_id)
      : Promise.resolve(null),
    selectedTab === "lounge" && snapshot.viewer.isAffiliated
      ? getFederationChatOverview(supabase, country.entity_id)
      : Promise.resolve(null),
  ]);

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
        />
      </section>
    </main>
  );
}
