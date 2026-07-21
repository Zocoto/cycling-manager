import "server-only";

import type { TeamDivisionCode } from "@/lib/game/economy";
import {
  getTeamDivisionLabel,
  normalizeTeamDivisionCode,
} from "@/lib/game/team-divisions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CurrentTeamDivision = {
  code: TeamDivisionCode;
  name: string;
};

export async function getCurrentTeamDivisionForAuthUser(
  authUserId: string
): Promise<CurrentTeamDivision | null> {
  const supabase = createSupabaseAdminClient();
  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    supabase
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", director.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<{ team_id: string }>(),
    supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
  ]);

  assertQuery(assignmentResult.error, "l’affectation à l’équipe");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const { data: teamSeason, error: teamSeasonError } = await supabase
    .from("team_seasons")
    .select("division_id")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<{ division_id: string | null }>();

  assertQuery(teamSeasonError, "la saison de l’équipe");
  if (!teamSeason) return null;

  let persistedCode: string | null = null;
  if (teamSeason.division_id) {
    const { data: division, error: divisionError } = await supabase
      .from("divisions")
      .select("code")
      .eq("id", teamSeason.division_id)
      .maybeSingle<{ code: string }>();
    assertQuery(divisionError, "la division de l’équipe");
    persistedCode = division?.code ?? null;
  }

  const code = normalizeTeamDivisionCode(persistedCode);
  return { code, name: getTeamDivisionLabel(code) };
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
