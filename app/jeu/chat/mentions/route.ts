import { GLOBAL_CHAT_MENTION_SEARCH_MIN_LENGTH } from "@/lib/game/global-chat";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchGlobalChatMentionRecipients } from "@/services/global-chat";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (
    query.length < GLOBAL_CHAT_MENTION_SEARCH_MIN_LENGTH ||
    query.length > 30
  ) {
    return Response.json([], {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    return Response.json(
      { error: "Vous devez être connecté pour rechercher un membre." },
      { status: 401 },
    );
  }

  try {
    const recipients = await searchGlobalChatMentionRecipients(
      supabase,
      query,
    );
    return Response.json(recipients, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "La recherche de membres est momentanément indisponible." },
      { status: 500 },
    );
  }
}
