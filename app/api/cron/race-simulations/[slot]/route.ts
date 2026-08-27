import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { precomputeDueOfficialRaceSimulations } from "@/services/race-simulation-runner";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await precomputeDueOfficialRaceSimulations(now);
  console.info("official_race_simulations_precomputed", {
    ...result,
    processedAt: now.toISOString(),
  });

  return Response.json({
    ...result,
    processedAt: now.toISOString(),
  });
}
