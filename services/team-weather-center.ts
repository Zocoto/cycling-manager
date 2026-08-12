import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getCurrentTeamWeatherCenterLevel(authUserId: string) {
  const admin = createSupabaseAdminClient();
  const director = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  if (director.error || !director.data) return 0;
  const assignment = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", director.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();
  if (assignment.error || !assignment.data) return 0;
  const infrastructure = await admin
    .from("team_infrastructures")
    .select("level")
    .eq("team_id", assignment.data.team_id)
    .eq("infrastructure_code", "weather_center")
    .maybeSingle<{ level: number }>();
  if (infrastructure.error) throw new Error(infrastructure.error.message);
  return Number(infrastructure.data?.level ?? 0);
}

export function getWeatherForecastHorizon(level: number) {
  return [0, 1, 3, 5, 8, 28][Math.max(0, Math.min(5, level))] ?? 0;
}
