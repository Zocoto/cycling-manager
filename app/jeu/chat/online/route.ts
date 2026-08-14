import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOnlineGlobalChatDirectors } from "@/services/global-chat";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    return Response.json(
      { error: "Vous devez être connecté pour consulter les joueurs en ligne." },
      { status: 401 },
    );
  }

  try {
    const directors = await getOnlineGlobalChatDirectors(supabase);

    return Response.json(
      { directors },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Les joueurs en ligne n’ont pas pu être actualisés." },
      { status: 500 },
    );
  }
}
