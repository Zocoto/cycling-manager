import { canAccessPrivateAdmin } from "@/lib/game/private-admin-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) return new Response(null, { status: 401 });
  if (!canAccessPrivateAdmin(user.email)) return new Response(null, { status: 404 });
  const requestedDays = Number(new URL(request.url).searchParams.get("days") ?? 7);
  const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(14, Math.floor(requestedDays))) : 7;
  const result = await createSupabaseAdminClient().rpc("get_performance_summary", { p_days: days });
  if (result.error) return Response.json({ error: "Mesures indisponibles." }, { status: 503 });
  return Response.json({ days, samples: result.data }, { headers: { "Cache-Control": "private, no-store" } });
}
