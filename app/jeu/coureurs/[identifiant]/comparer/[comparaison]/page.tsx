import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { ProfileBackButton } from "@/components/game/profile-back-button";
import { RiderComparisonView } from "@/components/game/rider-comparison-view";
import {
  createAmateurRiderJersey,
  createContinentalChampionRiderJersey,
  createNationalChampionRiderJersey,
  createSponsoredRiderJersey,
  createWorldChampionRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getPublicRiderProfile,
  type PublicRiderProfile,
} from "@/services/public-rider-profile";
import { getCurrentTeamRiderComparisonOptions } from "@/services/rider-comparison";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";

export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Comparaison de coureurs",
  description:
    "Comparez les caractéristiques et l’expérience de deux coureurs dans Cyclostratège.",
};

type RiderComparisonPageProps = {
  params: Promise<{
    identifiant: string;
    comparaison: string;
  }>;
};

export default async function RiderComparisonPage({
  params,
}: RiderComparisonPageProps) {
  const { identifiant, comparaison } = await params;
  const sourceRiderId = identifiant.trim().toLowerCase();
  const comparisonRiderId = comparaison.trim().toLowerCase();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, comparisonOptions] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamRiderComparisonOptions(supabase),
  ]);
  const comparisonBelongsToViewerTeam = comparisonOptions.some(
    (option) => option.id === comparisonRiderId,
  );

  if (
    sourceRiderId === comparisonRiderId ||
    !comparisonBelongsToViewerTeam
  ) {
    notFound();
  }

  const [sourceProfile, comparisonProfile] = await Promise.all([
    getPublicRiderProfile({
      riderIdentifier: sourceRiderId,
      viewerAuthUserId: user.id,
    }),
    getPublicRiderProfile({
      riderIdentifier: comparisonRiderId,
      viewerAuthUserId: user.id,
    }),
  ]);

  if (!sourceProfile || !comparisonProfile) notFound();

  const [sourceJersey, comparisonJersey] = await Promise.all([
    resolveComparisonJersey(sourceProfile),
    resolveComparisonJersey(comparisonProfile),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-11">
        <ProfileBackButton
          fallbackHref={`/jeu/coureurs/${sourceProfile.id}`}
          className="mb-5"
        />
        <RiderComparisonView
          left={sourceProfile}
          right={comparisonProfile}
          leftJersey={sourceJersey}
          rightJersey={comparisonJersey}
        />
      </section>
    </main>
  );
}

async function resolveComparisonJersey(
  profile: PublicRiderProfile,
): Promise<RiderJerseyAppearance> {
  const activeWorldTitle =
    profile.worldTitles.find(
      (title) => title.isActive && title.type === "road",
    ) ??
    profile.worldTitles.find(
      (title) => title.isActive && title.type === "time_trial",
    );
  if (activeWorldTitle) {
    return createWorldChampionRiderJersey({
      championshipType: activeWorldTitle.type,
    });
  }

  const activeContinentalTitle =
    profile.continentalTitles.find(
      (title) => title.isActive && title.type === "road",
    ) ??
    profile.continentalTitles.find(
      (title) => title.isActive && title.type === "time_trial",
    );
  if (activeContinentalTitle) {
    return createContinentalChampionRiderJersey({
      continentCode: activeContinentalTitle.continentCode,
      championshipType: activeContinentalTitle.type,
    });
  }

  const activeNationalTitle =
    profile.nationalTitles.find(
      (title) => title.isActive && title.type === "road",
    ) ??
    profile.nationalTitles.find(
      (title) => title.isActive && title.type === "time_trial",
    );
  if (activeNationalTitle) {
    return createNationalChampionRiderJersey({
      countryCode: activeNationalTitle.countryCode,
      championshipType: activeNationalTitle.type,
    });
  }

  if (!profile.currentTeam) return FREE_AGENT_RIDER_JERSEY;

  const [amateurIdentity, sponsorIdentity] = await Promise.all([
    getTeamAmateurIdentity(profile.currentTeam.id),
    getActiveTeamSponsorIdentity(profile.currentTeam.id),
  ]);
  if (sponsorIdentity) {
    return createSponsoredRiderJersey({
      colors: sponsorIdentity.sponsor.colors,
      style: sponsorIdentity.selectedJersey.style,
      imagePath: sponsorIdentity.selectedJersey.imagePath,
    });
  }
  if (amateurIdentity) return createAmateurRiderJersey(amateurIdentity.jersey);

  return FREE_AGENT_RIDER_JERSEY;
}
