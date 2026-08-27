import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { runTransferMarketMaintenance } from "@/services/transfer-market";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runTransferMarketMaintenance();
    return Response.json({ settledAt: new Date().toISOString() });
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
