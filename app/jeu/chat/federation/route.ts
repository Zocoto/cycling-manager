import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentFederationChatContext,
  getFederationChatOverview,
} from "@/services/federation-chat";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    return Response.json(
      { error: "Vous devez être connecté pour consulter ce salon." },
      { status: 401 },
    );
  }

  try {
    const context = await getCurrentFederationChatContext(supabase);
    if (!context) {
      return Response.json(
        { error: "Aucune fédération active n’est rattachée à votre équipe." },
        { status: 404 },
      );
    }

    const overview = await getFederationChatOverview(
      supabase,
      context.countryId,
    );

    return Response.json(
      { context, ...overview },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Impossible de charger le salon fédéral du chat :", error);
    return Response.json(
      { error: "Le salon de votre fédération est momentanément indisponible." },
      { status: 500 },
    );
  }
}
