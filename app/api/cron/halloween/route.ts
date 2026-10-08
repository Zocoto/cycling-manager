import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export const maxDuration = 30;
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return Response.json({ skipped: true });
  const { data, error } = await createSupabaseAdminClient().rpc("settle_halloween_event");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
