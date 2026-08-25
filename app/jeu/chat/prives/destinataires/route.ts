import { DIRECT_RECIPIENT_SEARCH_MIN_LENGTH } from "@/lib/game/direct-messages";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchDirectMessageRecipients } from "@/services/direct-messages";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  if (query.length < DIRECT_RECIPIENT_SEARCH_MIN_LENGTH) {
    return Response.json({ recipients: [] });
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
    const recipients = await searchDirectMessageRecipients(supabase, query);
    return Response.json(
      { recipients },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "La recherche de membres a échoué.",
      },
      { status: 500 },
    );
  }
}
