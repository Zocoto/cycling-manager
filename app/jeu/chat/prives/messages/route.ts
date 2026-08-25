import {
  isDirectMessageCursor,
  isUuid,
  type DirectMessageCursor,
} from "@/lib/game/direct-messages";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDirectMessagePage } from "@/services/direct-messages";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId") ?? "";
  const beforeCreatedAt = url.searchParams.get("beforeCreatedAt");
  const beforeId = url.searchParams.get("beforeId");
  const hasCursor = beforeCreatedAt !== null || beforeId !== null;
  const cursor: DirectMessageCursor | null = hasCursor
    ? {
        createdAt: beforeCreatedAt ?? "",
        id: beforeId ?? "",
      }
    : null;

  if (!isUuid(conversationId) || (cursor && !isDirectMessageCursor(cursor))) {
    return Response.json(
      { error: "La conversation ou son curseur est invalide." },
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
      { error: "Vous devez être connecté pour consulter vos MP." },
      { status: 401 },
    );
  }

  try {
    const page = await getDirectMessagePage(supabase, conversationId, {
      before: cursor,
    });

    return Response.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Les messages privés n’ont pas pu être chargés.",
      },
      { status: 500 },
    );
  }
}
