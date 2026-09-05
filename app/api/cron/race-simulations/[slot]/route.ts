import {
  getRaceJobPackFromSlot,
  RACE_SIMULATION_EDITION_BATCH_SIZE,
} from "@/lib/game/race-job-packs";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { precomputeDueOfficialRaceSimulations } from "@/services/race-simulation-runner";

export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slot } = await params;
  let jobPack;
  try {
    jobPack = getRaceJobPackFromSlot(slot);
  } catch {
    return Response.json({ error: "Invalid race job pack" }, { status: 400 });
  }
  const now = new Date();
  const result = await precomputeDueOfficialRaceSimulations(now, {
    ...jobPack,
    maxEditions: RACE_SIMULATION_EDITION_BATCH_SIZE,
  });
  console.info("official_race_simulations_precomputed", {
    ...result,
    processedAt: now.toISOString(),
  });

  return Response.json({
    ...result,
    processedAt: now.toISOString(),
  });
}
