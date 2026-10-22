import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { publishCyclogazetteEdition, recoverCyclogazetteSeasonFinale } from "@/services/cyclogazette";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const publication = new URL(request.url).pathname.endsWith("/finale-recovery")
    ? await recoverCyclogazetteSeasonFinale(now)
    : await publishCyclogazetteEdition(now);
  return Response.json({
    ...publication,
    push: "deferred",
    checkedAt: now.toISOString(),
  });
}
