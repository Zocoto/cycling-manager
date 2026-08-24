import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { settleCurrentRiderStateForMaintenance } from "@/services/game-state-settlement";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await settleCurrentRiderStateForMaintenance();

    return Response.json({
      settledAt: new Date().toISOString(),
      ok: true,
    });
  } catch (error) {
    console.error("Impossible de consolider l’état quotidien des coureurs :", error);

    return Response.json(
      {
        settledAt: new Date().toISOString(),
        ok: false,
      },
      { status: 500 },
    );
  }
}
