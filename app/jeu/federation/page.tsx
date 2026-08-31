import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamFederationCountryCode } from "@/services/national-federations";

export default async function CurrentFederationPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const headerData = await getGameHeaderData(supabase, user.id);
  if (!headerData.teamId) redirect("/jeu");

  const countryCode = await getCurrentTeamFederationCountryCode(
    headerData.teamId,
  );
  if (!countryCode) redirect("/jeu");

  redirect(`/jeu/federations/${countryCode.toLowerCase()}`);
}
