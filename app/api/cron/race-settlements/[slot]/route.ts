import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { processDueInternationalChampionshipSelections } from "@/services/international-championship-selections";
import { settleDueStandardRaceResults } from "@/services/race-settlement-runner";

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
  const internationalSelections = await runPreSettlementTask(
    "sélections internationales",
    () => processDueInternationalChampionshipSelections(now),
  );
  const settlement = await settleDueStandardRaceResults({
    now,
    raceSlug: requestedRaceSlug ?? undefined,
  });
  return Response.json({
    processedStages: settlement.processedStages,
    completedEditions: settlement.completedEditions,
    failedEditions: settlement.failedEditions,
    targetedEditions: settlement.targetedEditions,
    internationalSelections,
    preSettlementFailures: internationalSelections.ok ? 0 : 1,
    raceSlug: requestedRaceSlug,
    settledAt: now.toISOString(),
  });
}
