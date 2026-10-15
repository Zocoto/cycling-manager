import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOlympicSeason } from "@/lib/game/federation-olympic-programme";
import { QuadrennialGamesBanner } from "./quadrennial-games-banner";

export async function DashboardGamesShortcut() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("seasons").select("name,game_year")
    .eq("status", "active").abortSignal(AbortSignal.timeout(2500)).maybeSingle();
  if (error || !data || !isOlympicSeason(data.game_year)) return null;
  return <QuadrennialGamesBanner compact seasonName={data.name} />;
}
