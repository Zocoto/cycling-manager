import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export const maxDuration = 300;

const WORLD_SLUGS = new Set([
  "championnats-du-monde",
  "championnats-du-monde-contre-la-montre",
]);

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const admin = createSupabaseAdminClient();
  const discoveryCalendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeEngagedCounts: false,
    includeEngagedRiders: false,
    includeIneligibleRegionalRaces: true,
  });

  if (!discoveryCalendar) {
    return Response.json({
      processedStages: 0,
      completedEditions: 0,
      failedEditions: 0,
      settledAt: now.toISOString(),
    });
  }

  const worldEditionIds = discoveryCalendar.editions
    .filter(
      (edition) =>
        edition.competitionType === "world_championship" &&
        WORLD_SLUGS.has(edition.slug),
    )
    .map((edition) => edition.id);

  if (worldEditionIds.length !== 2) {
    return Response.json(
      {
        error: "Expected exactly two world championship editions.",
        editionCount: worldEditionIds.length,
      },
      { status: 409 },
    );
  }

  const calendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeIneligibleRegionalRaces: true,
    includeSimulationEnhancements: false,
    raceEditionIds: worldEditionIds,
  });
  if (!calendar || calendar.editions.length !== worldEditionIds.length) {
    return Response.json(
      { error: "Unable to load the targeted world championship editions." },
      { status: 409 },
    );
  }

  const settlement = await settleFinishedRaceResults(calendar, now);

  return Response.json({
    ...settlement,
    editions: calendar.editions.map((edition) => ({
      id: edition.id,
      slug: edition.slug,
      riders: edition.engagedRiders.length,
    })),
    settledAt: now.toISOString(),
  });
}
