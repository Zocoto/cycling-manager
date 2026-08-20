import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { processDueInternationalChampionshipSelections } from "@/services/international-championship-selections";
import { syncNationalChampionshipRegistrations } from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export const maxDuration = 300;

type PreSettlementTaskResult<T> =
  | { ok: true; value: T; error: null }
  | { ok: false; value: null; error: string };

async function runPreSettlementTask<T>(
  label: string,
  task: () => Promise<T>,
): Promise<PreSettlementTaskResult<T>> {
  try {
    return { ok: true, value: await task(), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Échec de la tâche préalable « ${label} » :`, error);
    return { ok: false, value: null, error: message };
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const requestedRaceSlug = new URL(request.url).searchParams.get("race");
  if (
    requestedRaceSlug &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedRaceSlug)
  ) {
    return Response.json({ error: "Invalid race slug" }, { status: 400 });
  }
  const [internationalSelections, nationalChampionshipEntries] =
    await Promise.all([
      runPreSettlementTask("sélections internationales", () =>
        processDueInternationalChampionshipSelections(now),
      ),
      runPreSettlementTask("inscriptions aux championnats nationaux", () =>
        syncNationalChampionshipRegistrations(now),
      ),
    ]);
  const admin = createSupabaseAdminClient();
  const calendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeIneligibleRegionalRaces: true,
    raceSlug: requestedRaceSlug ?? undefined,
  });
  if (!calendar) {
    return Response.json({
      processedStages: 0,
      completedEditions: 0,
      internationalSelections,
      nationalChampionshipEntries,
      preSettlementFailures: [
        internationalSelections,
        nationalChampionshipEntries,
      ].filter((task) => !task.ok).length,
      raceSlug: requestedRaceSlug,
    });
  }

  const settlement = await settleFinishedRaceResults(calendar, now);
  return Response.json({
    ...settlement,
    internationalSelections,
    nationalChampionshipEntries,
    preSettlementFailures: [
      internationalSelections,
      nationalChampionshipEntries,
    ].filter((task) => !task.ok).length,
    raceSlug: requestedRaceSlug,
    settledAt: now.toISOString(),
  });
}
