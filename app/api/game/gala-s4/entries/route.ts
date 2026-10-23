import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGalaEvent } from "@/lib/game/season-four-gala";
import { getSeasonFourGalaEntries } from "@/services/season-four-gala-registration";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(client);
  if (error || !user) return Response.json({ error: "Authentification requise." }, { status: 401, headers });
  const query = new URL(request.url).searchParams;
  const event = getGalaEvent(`${query.get("program")}:${query.get("profile")}`);
  const rawPage = query.get("page") ?? "0";
  if (!event || !/^\d{1,4}$/.test(rawPage) || Number(rawPage) > 1000) return Response.json({ error: "Course du gala invalide." }, { status: 400, headers });
  try {
    return Response.json(await getSeasonFourGalaEntries(client, event.program, event.profile, Number(rawPage)), { headers });
  } catch {
    return Response.json({ error: "Impossible de charger les engagés. Réessayez." }, { status: 503, headers });
  }
}
