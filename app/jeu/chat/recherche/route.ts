import {
  GLOBAL_CHAT_SEARCH_MIN_LENGTH,
  normalizeGlobalChatSearchQuery,
} from "@/lib/game/global-chat";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchGlobalChatMessages } from "@/services/global-chat";

export async function GET(request: Request) {
  const query = normalizeGlobalChatSearchQuery(
    new URL(request.url).searchParams.get("q") ?? "",
  );
  if (query.length < GLOBAL_CHAT_SEARCH_MIN_LENGTH) {
    return Response.json(
      { error: "Saisissez au moins deux caractères." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    return Response.json(
      { error: "Vous devez être connecté pour rechercher dans le chat." },
      { status: 401 },
    );
  }

  try {
    const messages = await searchGlobalChatMessages(supabase, query);
    return Response.json(
      { query, messages },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Recherche globale du chat indisponible :", error);
    return Response.json(
      { error: "La recherche dans le chat est momentanément indisponible." },
      { status: 500 },
    );
  }
}
