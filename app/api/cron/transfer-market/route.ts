import { after } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { dispatchDuePushNotifications } from "@/services/push-notifications";
import { runTransferMarketMaintenance } from "@/services/transfer-market";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTransferMarketMaintenance();
    console.info("transfer_market_maintenance_completed", result);
    after(async () => {
      try {
        await dispatchDuePushNotifications({ enqueueRaceLives: false });
      } catch (error) {
        console.error(
          "Impossible de distribuer immédiatement les notifications du marché des transferts.",
          error,
        );
      }
    });
    return Response.json({
      ...result,
      settledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Échec de la maintenance du marché des transferts.", error);
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "Maintenance du marché des transferts impossible.",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
