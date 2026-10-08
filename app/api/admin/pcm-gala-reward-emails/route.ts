import { canAccessPrivateAdmin } from "@/lib/game/private-admin-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendSeasonFinaleGalaRewardEmails } from "@/services/season-finale-gala-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (!canAccessPrivateAdmin(user.email)) return Response.json({ error: "Ressource introuvable." }, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("x-cs-requested-with") !== "pcm-gala-reward-emails-admin") {
    return Response.json({ error: "Requête invalide." }, { status: 403 });
  }
  try {
    return Response.json(await sendSeasonFinaleGalaRewardEmails(), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Les mails n’ont pas pu être traités. Les lots déjà attribués restent acquis." }, { status: 500 });
  }
}
