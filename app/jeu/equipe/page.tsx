import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export default async function CurrentTeamRedirectPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);

  if (error || !user) {
    redirect("/connexion");
  }

  const headerData = await getGameHeaderData(supabase, user.id);

  if (!headerData.teamId) {
    redirect("/jeu");
  }

  redirect(`/jeu/equipes/${encodeURIComponent(headerData.teamId)}`);
}
