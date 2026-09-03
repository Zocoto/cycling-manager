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

  const startedAt = Date.now();
  const now = new Date();
  const requestedRaceSlug = new URL(request.url).searchParams.get("race");
  if (
    requestedRaceSlug &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedRaceSlug)
  ) {
    return Response.json({ error: "Invalid race slug" }, { status: 400 });
  }
  const preSettlementStartedAt = Date.now();
  // Une reprise manuelle ciblée doit rester strictement cantonnée à la course
  // demandée. Les maintenances globales continuent de tourner sur les appels
  // planifiés, dépourvus du paramètre `race`.
  const internationalSelections = requestedRaceSlug
    ? ({
        ok: true,
        value: { skipped: "targeted_race_settlement" },
        error: null,
      } as const)
    : await runPreSettlementTask("sélections internationales", () =>
        processDueInternationalChampionshipSelections(now),
      );
  const preSettlementDurationMs = Date.now() - preSettlementStartedAt;
  const settlementStartedAt = Date.now();
  const settlement = await settleDueStandardRaceResults({
    now,
    raceSlug: requestedRaceSlug ?? undefined,
  });
  const settlementDurationMs = Date.now() - settlementStartedAt;
  const result = {
    processedStages: settlement.processedStages,
    completedEditions: settlement.completedEditions,
    failedEditions: settlement.failedEditions,
    targetedEditions: settlement.targetedEditions,
    internationalSelections,
    preSettlementFailures: internationalSelections.ok ? 0 : 1,
    raceSlug: requestedRaceSlug,
    settledAt: now.toISOString(),
    preSettlementDurationMs,
    settlementDurationMs,
    durationMs: Date.now() - startedAt,
  };
  console.info("official_race_settlement_completed", result);
  return Response.json(result);
}
