import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicTeam } from "@/services/public-directory";
import { getTeamRankingEntry } from "@/services/uci-rankings";
import type { TeamQuickPreview } from "@/lib/game/team-quick-preview";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ identifiant: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) {
    return Response.json({ message: "Authentification requise." }, { status: 401 });
  }

  try {
    const { identifiant } = await params;
    const team = await getPublicTeam(supabase, identifiant);
    if (!team || team.result_type !== "team") {
      return Response.json({ message: "Équipe introuvable." }, { status: 404 });
    }
    const ranking = await getTeamRankingEntry(team.entity_id).catch(() => null);
    const preview: TeamQuickPreview = {
      id: team.entity_id,
      name: team.display_name,
      countryName: team.country_name,
      countryCode: team.country_code,
      divisionName: team.division_name,
      sponsorName: team.sponsor_name,
      directorName: team.sporting_director_name,
      ranking: ranking ? { rank: ranking.rank, points: ranking.points } : null,
    };
    return Response.json(preview, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (previewError) {
    console.error("Échec du chargement de l’aperçu équipe :", previewError);
    return Response.json(
      { message: "L’aperçu de l’équipe est momentanément indisponible." },
      { status: 500 },
    );
  }
}
