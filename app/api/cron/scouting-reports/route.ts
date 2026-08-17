import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { settleDueYouthScoutingMissions } from "@/services/youth-development";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  try {
    const completedReports = await settleDueYouthScoutingMissions();
    return Response.json({ checkedAt, completedReports });
  } catch (error) {
    return Response.json(
      {
        checkedAt,
        error:
          error instanceof Error
            ? error.message
            : "Finalisation automatique des scoutings impossible.",
      },
      { status: 500 },
    );
  }
}
