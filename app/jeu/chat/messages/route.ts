import {
  isGlobalChatCursor,
  type GlobalChatCursor,
} from "@/lib/game/global-chat";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGlobalChatMessagePage } from "@/services/global-chat";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor: GlobalChatCursor = {
    createdAt: url.searchParams.get("beforeCreatedAt") ?? "",
    id: url.searchParams.get("beforeId") ?? "",
  };

  if (!isGlobalChatCursor(cursor)) {
    return Response.json(
      { error: "Le curseur de discussion est invalide." },
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
      { error: "Vous devez être connecté pour consulter le chat." },
      { status: 401 },
    );
  }

  try {
    const page = await getGlobalChatMessagePage(supabase, {
      before: cursor,
    });

    return Response.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Les anciens messages n’ont pas pu être chargés." },
      { status: 500 },
    );
  }
}