import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CyclogazetteArchiveNavigation } from "@/components/game/cyclogazette-archive-navigation";
import { CyclogazetteGamesSidebar } from "@/components/game/cyclogazette-games-sidebar";
import { CyclogazetteNewspaper } from "@/components/game/cyclogazette-newspaper";
import { CyclogazetteReadMarker } from "@/components/game/cyclogazette-read-marker";
import { GameHeader } from "@/components/game/game-header";
import { MediaCenterComposer } from "@/components/game/media-center-composer";
import { isItalianGrandTourGazetteDay } from "@/lib/game/cyclogazette";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCyclogazetteArchive,
  getCyclogazetteCommunity,
  getCyclogazetteEditionById,
  getLatestCyclogazetteEdition,
} from "@/services/cyclogazette";
import { getCyclogazetteGamesOverview } from "@/services/cyclogazette-games";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamMediaCenterOverview } from "@/services/team-media-center";

export const metadata: Metadata = {
  title: "La Cyclogazette",
  description:
    "Le journal quotidien des courses, du mercato et des directeurs sportifs de Cyclo Stratège.",
};

export default async function CyclogazettePage({
  searchParams,
}: {
  searchParams: Promise<{
    edition?: string | string[];
    article?: string | string[];
    erreur?: string | string[];
  }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const params = await searchParams;
  const requestedEditionId = Array.isArray(params.edition)
    ? params.edition[0]
    : params.edition;
  const [headerData, latestEdition, mediaCenterOverview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getLatestCyclogazetteEdition(),
    getCurrentTeamMediaCenterOverview(user.id),
  ]);
  const [archive, requestedEdition] = await Promise.all([
    getCyclogazetteArchive(),
    requestedEditionId && requestedEditionId !== latestEdition?.id
      ? getCyclogazetteEditionById(requestedEditionId)
      : Promise.resolve(null),
  ]);
  const edition = requestedEdition ?? latestEdition;
  const previousIssueNumber = edition
    ? archive
        .flatMap((season) => season.editions)
        .filter((entry) => entry.issueNumber < edition.issueNumber)
        .sort((left, right) => right.issueNumber - left.issueNumber)[0]
        ?.issueNumber ?? null
    : null;
  const [community, gamesOverview] =
    edition && latestEdition
      ? await Promise.all([
          getCyclogazetteCommunity(
            edition.id,
            user.id,
            edition.content.reactions,
          ),
          getCyclogazetteGamesOverview({
            supabase,
            edition,
            latestEditionId: latestEdition.id,
            previousIssueNumber,
          }),
        ])
      : [null, null];
  const isItalianGrandTourEdition = isItalianGrandTourGazetteDay(
    edition?.dayNumber ?? 0,
  );

  return (
    <main
      className={`min-h-screen text-[#082A2A] ${isItalianGrandTourEdition ? "bg-[#DDA6B3]" : "bg-[#D9D4C8]"}`}
    >
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
        gazetteIsOpen
      />
      <div className="px-2 py-5 sm:px-5 sm:py-9 lg:px-8">
        {mediaCenterOverview ? (
          <MediaCenterComposer
            overview={mediaCenterOverview}
            success={readQuery(params.article) === "propose"}
            errorMessage={readQuery(params.erreur)}
          />
        ) : null}
        {edition && latestEdition ? (
          <>
            <CyclogazetteReadMarker editionId={edition.id} />
            <CyclogazetteArchiveNavigation
              seasons={archive}
              currentEditionId={edition.id}
              latestEditionId={latestEdition.id}
            />
            <div className="mx-auto grid max-w-[1740px] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <CyclogazetteNewspaper
                edition={edition}
                community={community ?? undefined}
                interviewReactions={community?.interviewReactions}
              />
              {gamesOverview ? (
                <CyclogazetteGamesSidebar
                  key={edition.id}
                  overview={gamesOverview}
                />
              ) : null}
            </div>
          </>
        ) : (
          <EmptyGazette />
        )}
      </div>
    </main>
  );
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function EmptyGazette() {
  return (
    <section className="mx-auto max-w-[1100px] border border-[#9A8A65]/40 bg-[#F4EBD2] px-6 py-20 text-center shadow-[0_35px_100px_rgba(45,34,20,0.2)] sm:px-12">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">
        La rédaction prépare sa une
      </p>
      <h1 className="mt-4 font-serif text-5xl font-black tracking-[-0.05em] sm:text-7xl">
        La Cyclogazette
      </h1>
      <p className="mx-auto mt-5 max-w-xl font-serif text-lg italic leading-7 text-[#695D43]">
        La première édition sera mise sous presse ce soir à 20 h. Revenez
        découvrir les résultats, les mouvements du mercato et les réactions des
        Directeurs Sportifs.
      </p>
    </section>
  );
}
