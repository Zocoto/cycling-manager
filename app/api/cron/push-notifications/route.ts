import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { dispatchDuePushNotifications } from "@/services/push-notifications";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dispatchDuePushNotifications({ limit: 20 });
    return Response.json({ ...result, checkedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Distribution push impossible.",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
