import {
  isDirectConversationCursor,
  type DirectConversationCursor,
} from "@/lib/game/direct-messages";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getDirectConversationPage,
  getDirectMessagingOverview,
} from "@/services/direct-messages";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const beforeActivityAt = url.searchParams.get("beforeActivityAt");
  const beforeId = url.searchParams.get("beforeId");
  const hasCursor = beforeActivityAt !== null || beforeId !== null;
  const cursor: DirectConversationCursor | null = hasCursor
    ? {
        lastActivityAt: beforeActivityAt ?? "",
        id: beforeId ?? "",
      }
    : null;

  if (cursor && !isDirectConversationCursor(cursor)) {
    return Response.json(
      { error: "Le curseur des conversations est invalide." },
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
    const result = cursor
      ? {
          conversationPage: await getDirectConversationPage(supabase, {
            before: cursor,
          }),
          totalUnreadCount: null,
        }
      : await getDirectMessagingOverview(supabase);

    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Les conversations privées n’ont pas pu être chargées.",
      },
      { status: 500 },
    );
  }
}
