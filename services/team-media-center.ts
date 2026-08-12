import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ArticleRow = {
  id: string;
  season_id: string;
  day_number: number;
  title: string;
  sponsor_name: string | null;
  building_level: number;
  reputation_awarded: number | string;
  supporters_awarded: number;
  status: "queued" | "published";
  created_at: string;
};

export type TeamMediaCenterOverview = {
  teamName: string;
  buildingLevel: number;
  currentDayNumber: number;
  canSubmit: boolean;
  nextSubmissionInDays: number;
  publicationIntervalDays: number;
  canIncludeSponsor: boolean;
  sponsorName: string | null;
  recentArticles: Array<{
    id: string;
    dayNumber: number;
    title: string;
    sponsorName: string | null;
    reputationAwarded: number;
    supportersAwarded: number;
    status: ArticleRow["status"];
  }>;
};

export async function getCurrentTeamMediaCenterOverview(
  authUserId: string,
): Promise<TeamMediaCenterOverview | null> {
  const admin = createSupabaseAdminClient();
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  if (directorResult.error) throw new Error(directorResult.error.message);
  if (!directorResult.data) return null;

  const assignmentResult = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();
  if (assignmentResult.error || !assignmentResult.data) return null;

  const seasonResult = await admin
    .from("seasons")
    .select("id,game_year,current_day_number")
    .eq("status", "active")
    .maybeSingle<{
      id: string;
      game_year: number;
      current_day_number: number;
    }>();
  if (seasonResult.error || !seasonResult.data) return null;

  const teamId = assignmentResult.data.team_id;
  const [
    teamSeasonResult,
    infrastructureResult,
    articlesResult,
    sponsorResult,
  ] = await Promise.all([
    admin
      .from("team_seasons")
      .select("display_name")
      .eq("team_id", teamId)
      .eq("season_id", seasonResult.data.id)
      .maybeSingle<{ display_name: string }>(),
    admin
      .from("team_infrastructures")
      .select("level")
      .eq("team_id", teamId)
      .eq("infrastructure_code", "media_center")
      .maybeSingle<{ level: number }>(),
    admin
      .from("media_center_articles")
      .select(
        "id,season_id,day_number,title,sponsor_name,building_level,reputation_awarded,supporters_awarded,status,created_at",
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ArticleRow[]>(),
    admin
      .from("team_sponsor_contracts")
      .select("sponsors(name)")
      .eq("team_id", teamId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle<{ sponsors: { name: string } | null }>(),
  ]);
  if (teamSeasonResult.error || !teamSeasonResult.data) return null;
  if (infrastructureResult.error)
    throw new Error(infrastructureResult.error.message);
  if (articlesResult.error) throw new Error(articlesResult.error.message);

  const buildingLevel = Number(infrastructureResult.data?.level ?? 0);
  const publicationIntervalDays =
    [7, 5, 4, 3, 2][Math.max(1, buildingLevel) - 1] ?? 7;
  const currentGameDayIndex =
    seasonResult.data.game_year * 28 + seasonResult.data.current_day_number - 1;
  const lastArticle = articlesResult.data?.[0] ?? null;
  let nextSubmissionInDays = 0;
  if (lastArticle) {
    const articleSeasonResult = await admin
      .from("seasons")
      .select("game_year")
      .eq("id", lastArticle.season_id)
      .maybeSingle<{ game_year: number }>();
    const lastGameDayIndex =
      Number(
        articleSeasonResult.data?.game_year ?? seasonResult.data.game_year,
      ) *
        28 +
      lastArticle.day_number -
      1;
    nextSubmissionInDays = Math.max(
      0,
      publicationIntervalDays - (currentGameDayIndex - lastGameDayIndex),
    );
  }
  const sponsorName = sponsorResult.data?.sponsors?.name ?? null;

  return {
    teamName: teamSeasonResult.data.display_name,
    buildingLevel,
    currentDayNumber: seasonResult.data.current_day_number,
    canSubmit: buildingLevel >= 1 && nextSubmissionInDays === 0,
    nextSubmissionInDays,
    publicationIntervalDays,
    canIncludeSponsor: buildingLevel >= 3 && sponsorName !== null,
    sponsorName,
    recentArticles: (articlesResult.data ?? []).map((article) => ({
      id: article.id,
      dayNumber: Number(article.day_number),
      title: article.title,
      sponsorName: article.sponsor_name,
      reputationAwarded: Number(article.reputation_awarded),
      supportersAwarded: Number(article.supporters_awarded),
      status: article.status,
    })),
  };
}
