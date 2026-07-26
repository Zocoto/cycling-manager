import "server-only";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TutorialOnboardingState } from "@/lib/tutorial/onboarding";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type SportingDirectorOnboardingRow = {
  country_id: string | null;
  avatar_key: string | null;
};

type CurrentTeamOnboardingRow = {
  team_id: string;
  rider_count: number;
};

export async function getAuthenticatedTutorialOnboardingState(
  supabase: SupabaseServerClient,
): Promise<TutorialOnboardingState> {
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    throw new Error(
      "La session utilisateur est absente ou invalide.",
    );
  }

  const [profileResult, teamResult] = await Promise.all([
    supabase
      .from("sporting_directors")
      .select("country_id, avatar_key")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .maybeSingle<SportingDirectorOnboardingRow>(),
    supabase
      .rpc("get_current_team_dashboard_summary")
      .maybeSingle<CurrentTeamOnboardingRow>(),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(
      `Impossible de vérifier le profil du Directeur Sportif : ${profileResult.error?.message ?? "profil introuvable"}`,
    );
  }

  if (teamResult.error) {
    throw new Error(
      `Impossible de vérifier la création de l’équipe : ${teamResult.error.message}`,
    );
  }

  const riderCount = Math.max(
    0,
    Number(teamResult.data?.rider_count ?? 0),
  );

  return {
    profileComplete: Boolean(
      profileResult.data.country_id &&
        profileResult.data.avatar_key,
    ),
    teamCreated: Boolean(
      teamResult.data?.team_id && riderCount > 0,
    ),
    riderCount,
  };
}
