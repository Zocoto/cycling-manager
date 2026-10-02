import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return new Response(null, { status: 401 });
  const result = await createSupabaseAdminClient().rpc("prune_performance_samples");
  return Response.json({ ok: !result.error, removed: result.data ?? 0 }, { status: result.error ? 503 : 200 });
}
