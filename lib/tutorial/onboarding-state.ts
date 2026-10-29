import "server-only";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TutorialOnboardingState } from "@/lib/tutorial/onboarding";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type SportingDirectorOnboardingRow = {
  id: string;
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
      .select("id, country_id, avatar_key")
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
  let teamCreated = Boolean(teamResult.data?.team_id && riderCount > 0);
  if (!teamCreated) {
    // A founded club stays founded after its contracts expire or its last
    // rider leaves. Only this rare empty-roster case needs one indexed read.
    // Scope the service-role lookup to the authenticated director, never an
    // identifier supplied by the browser.
    const { data: assignment, error: foundationError } = await createSupabaseAdminClient()
      .from("team_manager_assignments")
      .select("team:teams!inner(amateur_name, amateur_identity_configured_at, status)")
      .eq("sporting_director_id", profileResult.data.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ team: {
        amateur_name: string | null;
        amateur_identity_configured_at: string | null;
        status: string;
      } | null }>();
    if (foundationError) {
      throw new Error("Impossible de vérifier la fondation de l’équipe. Réessayez dans un instant.");
    }
    teamCreated = Boolean(assignment?.team?.status === "active" &&
      assignment.team.amateur_name && assignment.team.amateur_identity_configured_at);
  }

  return {
    profileComplete: Boolean(
      profileResult.data.country_id &&
        profileResult.data.avatar_key,
    ),
    teamCreated,
    riderCount,
  };
}
