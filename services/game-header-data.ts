import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveTeamSponsorIdentityForAuthUser,
  type TeamSponsorIdentity,
} from "@/services/team-sponsor-identity";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type HeaderProfile = {
  display_name: string;
};

export type GameHeaderData = {
  displayName: string | undefined;
  teamSponsorIdentity: TeamSponsorIdentity | null;
};

export async function getGameHeaderData(
  supabase: SupabaseServerClient,
  authUserId: string
): Promise<GameHeaderData> {
  const [profileResult, sponsorResult] = await Promise.all([
    supabase
      .from("sporting_directors")
      .select("display_name")
      .eq("auth_user_id", authUserId)
      .maybeSingle<HeaderProfile>(),

    getActiveTeamSponsorIdentityForAuthUser(authUserId)
      .then((teamSponsorIdentity) => ({
        teamSponsorIdentity,
        error: null,
      }))
      .catch((error: unknown) => ({
        teamSponsorIdentity: null,
        error,
      })),
  ]);

  if (profileResult.error) {
    console.error(
      "Impossible de charger le nom du Directeur Sportif dans le header :",
      profileResult.error
    );
  }

  if (sponsorResult.error) {
    console.error(
      "Impossible de charger l’identité visuelle du sponsor dans le header :",
      sponsorResult.error
    );
  }

  return {
    displayName: profileResult.data?.display_name,
    teamSponsorIdentity: sponsorResult.teamSponsorIdentity,
  };
}
