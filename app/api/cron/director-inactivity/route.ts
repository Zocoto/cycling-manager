import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { processDirectorInactivityLifecycle } from "@/services/director-inactivity";

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDirectorInactivityLifecycle();
    const hasFailures =
      result.warningFailures > 0 || result.deletionFailures > 0;

    return Response.json(
      { ...result, checkedAt: new Date().toISOString() },
      { status: hasFailures ? 500 : 200 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Traitement de l’inactivité impossible.",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
