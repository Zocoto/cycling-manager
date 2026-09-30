import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type ScoutingVisibilityStatus = {
  active: boolean;
  activeUntil: string | null;
};

export async function getTeamSeasonScoutingVisibility(
  admin: AdminClient,
  teamSeasonId: string,
): Promise<ScoutingVisibilityStatus> {
  const { data, error } = await admin
    .from("team_seasons")
    .select("scouting_reports_revealed_until")
    .eq("id", teamSeasonId)
    .maybeSingle<{ scouting_reports_revealed_until: string | null }>();

  if (error) {
    throw new Error(
      `Impossible de charger la visibilité du scouting : ${error.message}`,
    );
  }

  return normalizeScoutingVisibility(data?.scouting_reports_revealed_until);
}

export async function getViewerScoutingVisibility({
  admin,
  authUserId,
  seasonId,
}: {
  admin: AdminClient;
  authUserId: string;
  seasonId: string;
}): Promise<ScoutingVisibilityStatus> {
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (directorResult.error) {
    throw new Error(
      `Impossible d’identifier le Directeur Sportif : ${directorResult.error.message}`,
    );
  }
  if (!directorResult.data) return { active: false, activeUntil: null };

  const assignmentResult = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();

  if (assignmentResult.error) {
    throw new Error(
      `Impossible d’identifier l’équipe du Directeur Sportif : ${assignmentResult.error.message}`,
    );
  }
  if (!assignmentResult.data) return { active: false, activeUntil: null };

  const teamSeasonResult = await admin
    .from("team_seasons")
    .select("scouting_reports_revealed_until")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonId)
    .in("status", ["planned", "active"])
    .maybeSingle<{ scouting_reports_revealed_until: string | null }>();

  if (teamSeasonResult.error) {
    throw new Error(
      `Impossible de charger la saison de l’équipe : ${teamSeasonResult.error.message}`,
    );
  }

  return normalizeScoutingVisibility(
    teamSeasonResult.data?.scouting_reports_revealed_until,
  );
}

export function normalizeScoutingVisibility(
  activeUntil: string | null | undefined,
  now = Date.now(),
): ScoutingVisibilityStatus {
  const parsed = activeUntil ? Date.parse(activeUntil) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= now) {
    return { active: false, activeUntil: null };
  }
  return { active: true, activeUntil: activeUntil ?? null };
}
