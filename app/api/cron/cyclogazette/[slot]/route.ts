import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { publishCyclogazetteEdition } from "@/services/cyclogazette";
import { dispatchDuePushNotifications } from "@/services/push-notifications";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const publication = await publishCyclogazetteEdition(now);
  let push: Awaited<ReturnType<typeof dispatchDuePushNotifications>> | null = null;
  try {
    push = await dispatchDuePushNotifications({ enqueueRaceLives: false });
  } catch (error) {
    console.error(
      "La Cyclogazette est publiée mais sa notification immédiate a échoué.",
      error,
    );
  }
  return Response.json({
    ...publication,
    push,
    checkedAt: now.toISOString(),
  });
}
