import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AppLink from "@/components/ui/app-link";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { PcmGalaRegistrationPanel } from "@/components/game/pcm-gala-registration-panel";
import { PcmGalaStartlistExportPanel } from "@/components/game/pcm-gala-startlist-export-panel";
import { SeasonFinaleGalaPresentation } from "@/components/game/season-finale-gala-presentation";
import { SeasonFinaleGalaReplay } from "@/components/game/season-finale-gala-replay";
import { canAccessPcmExport } from "@/lib/game/pcm-export/access";
import { readGalaYoutubeVideoId, SEASON_FINALE_GALA_EVENT_KEY, SEASON_FINALE_GALA_NAME } from "@/lib/game/season-finale-gala";
import { createAmateurRiderJersey, createSponsoredRiderJersey, FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPcmGalaRegistrationContext } from "@/services/pcm-gala-registration";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";

export const metadata: Metadata = {
  title: SEASON_FINALE_GALA_NAME,
  description: "Un gala vallonné hors-circuit simulé dans PCM26 : inscriptions de 6 à 8 coureurs, lots du top 5 de chaque groupe et replay vidéo, sans impact sur la forme.",
};

export default async function SeasonFinaleGalaPage({ searchParams }: {
  searchParams: Promise<{ inscription?: string | string[]; erreur?: string | string[] }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [headerData, context, params] = await Promise.all([
    getGameHeaderData(supabase, user.id), getPcmGalaRegistrationContext(supabase), searchParams,
  ]);
  const amateurIdentity = headerData.teamSponsorIdentity ? null : await getTeamAmateurIdentityForAuthUser(user.id).catch(() => null);
  const jersey = headerData.teamSponsorIdentity
    ? createSponsoredRiderJersey({ colors: headerData.teamSponsorIdentity.sponsor.colors, style: headerData.teamSponsorIdentity.selectedJersey.style, imagePath: headerData.teamSponsorIdentity.selectedJersey.imagePath })
    : amateurIdentity ? createAmateurRiderJersey(amateurIdentity.jersey) : FREE_AGENT_RIDER_JERSEY;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorVisual} maxWidth="wide" />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-8 sm:py-9">
        <div className="flex justify-end"><BackToOfficeLink /></div>
        <SeasonFinaleGalaPresentation />
        <div id="inscriptions-gala" className="scroll-mt-6">
          <PcmGalaRegistrationPanel {...context} jersey={jersey} seasonFinale successMessage={readMessage(params.inscription)} errorMessage={readMessage(params.erreur)} />
        </div>
        <SeasonFinaleGalaReplay videoId={readGalaYoutubeVideoId(process.env.PCM_GALA_REPLAY_YOUTUBE_URL)} />
        {canAccessPcmExport(user.email) ? (
          <div className="mt-8 border-t border-[#BCD3C8] pt-6">
            <p className="text-xs font-black uppercase tracking-widest text-[#557068]">Organisation · Administration uniquement</p>
            <PcmGalaStartlistExportPanel eventKey={SEASON_FINALE_GALA_EVENT_KEY} />
            <p className="mt-4 text-sm leading-6 text-[#557068]">Pour la première simulation, utilise aussi <AppLink href="/jeu/export-pcm" className="font-black text-[#176951] underline">l’extracteur de la base Cyclostratège</AppLink> : la DB et la startlist doivent partager les mêmes identifiants PCM.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function readMessage(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
