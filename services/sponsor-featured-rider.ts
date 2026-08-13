import "server-only";

import type { FeaturedRiderSponsorAffinity } from "@/lib/game/sponsor-nationality-affinity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ActiveRiderContractRow = {
  rider_id: string;
};

type RiderSeasonSummaryRow = {
  rider_id: string;
  points: number | string | null;
};

type RiderCountryRow = {
  country_id: string;
};

type CountryRow = {
  iso_alpha2: string;
};

export async function loadFeaturedRiderSponsorAffinity({
  supabase,
  teamId,
  seasonId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  seasonId: string;
}): Promise<FeaturedRiderSponsorAffinity | null> {
  const { data: contractRows, error: contractError } = await supabase
    .from("rider_contracts")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("status", "active")
    .returns<ActiveRiderContractRow[]>();

  if (contractError) {
    throw new Error(
      `Impossible de charger l'effectif pour identifier le coureur phare : ${contractError.message}`
    );
  }

  const riderIds = [
    ...new Set((contractRows ?? []).map((contract) => contract.rider_id)),
  ];
  if (riderIds.length === 0) return null;

  const { data: summaryRows, error: summaryError } = await supabase
    .from("rider_season_summaries")
    .select("rider_id, points")
    .eq("season_id", seasonId)
    .in("rider_id", riderIds)
    .gt("points", 0)
    .order("points", { ascending: false })
    .order("rider_id", { ascending: true })
    .limit(1)
    .returns<RiderSeasonSummaryRow[]>();

  if (summaryError) {
    throw new Error(
      `Impossible de charger le classement UCI de l'effectif : ${summaryError.message}`
    );
  }

  const featuredRider = summaryRows?.[0];
  const uciPoints = Number(featuredRider?.points ?? 0);
  if (!featuredRider || !Number.isFinite(uciPoints) || uciPoints <= 0) {
    return null;
  }

  const { data: rider, error: riderError } = await supabase
    .from("riders")
    .select("country_id")
    .eq("id", featuredRider.rider_id)
    .maybeSingle<RiderCountryRow>();

  if (riderError || !rider) {
    throw new Error(
      "Impossible de charger la nationalite du coureur phare de l'equipe."
    );
  }

  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("iso_alpha2")
    .eq("id", rider.country_id)
    .maybeSingle<CountryRow>();

  if (countryError || !country) {
    throw new Error(
      "Impossible de charger le pays du coureur phare de l'equipe."
    );
  }

  return {
    countryCode: country.iso_alpha2.trim().toUpperCase(),
    uciPoints,
  };
}
