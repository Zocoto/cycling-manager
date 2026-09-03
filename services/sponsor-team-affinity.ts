import "server-only";

import type { TeamSponsorCountryAffinity } from "@/lib/game/sponsor-nationality-affinity";
import { resolveRegionalSponsorPreference } from "@/lib/game/sponsor-regional-affinity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type TeamRow = {
  home_country_id: string;
};

type TeamSeasonIdentityRow = {
  display_name: string;
};

type RiderContractRow = {
  rider_id: string;
};

type RiderRow = {
  id: string;
  country_id: string;
};

type RiderSeasonSummaryRow = {
  rider_id: string;
  points: number | string | null;
};

type CountryRow = {
  id: string;
  iso_alpha2: string;
};

const LEADER_COUNTRY_COUNT = 3;

export async function loadTeamSponsorCountryAffinity({
  supabase,
  teamId,
  seasonId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  seasonId: string;
}): Promise<TeamSponsorCountryAffinity> {
  const [teamResult, contractsResult, teamIdentitiesResult] = await Promise.all([
    supabase
      .from("teams")
      .select("home_country_id")
      .eq("id", teamId)
      .maybeSingle<TeamRow>(),
    supabase
      .from("rider_contracts")
      .select("rider_id")
      .eq("team_id", teamId)
      .eq("status", "active")
      .returns<RiderContractRow[]>(),
    supabase
      .from("team_seasons")
      .select("display_name")
      .eq("team_id", teamId)
      .returns<TeamSeasonIdentityRow[]>(),
  ]);

  if (teamResult.error || !teamResult.data) {
    throw new Error(
      "Impossible de charger le pays fondateur de l'équipe pour le sponsoring."
    );
  }

  if (contractsResult.error) {
    throw new Error(
      `Impossible de charger l'effectif pour le sponsoring : ${contractsResult.error.message}`
    );
  }

  if (teamIdentitiesResult.error) {
    throw new Error(
      `Impossible de charger l'identité historique de l'équipe : ${teamIdentitiesResult.error.message}`
    );
  }

  const preferredSponsorIds = resolveRegionalSponsorPreference(
    (teamIdentitiesResult.data ?? []).map((teamSeason) =>
      teamSeason.display_name
    )
  );

  const riderIds = [
    ...new Set((contractsResult.data ?? []).map((contract) => contract.rider_id)),
  ];
  const countryIds = new Set<string>([teamResult.data.home_country_id]);

  if (riderIds.length === 0) {
    return {
      teamCountryCode: await loadCountryCode({
        supabase,
        countryId: teamResult.data.home_country_id,
      }),
      leaderCountryCodes: [],
      rosterMajorityCountryCode: null,
      preferredSponsorIds,
    };
  }

  const [ridersResult, summariesResult] = await Promise.all([
    supabase
      .from("riders")
      .select("id, country_id")
      .in("id", riderIds)
      .returns<RiderRow[]>(),
    supabase
      .from("rider_season_summaries")
      .select("rider_id, points")
      .eq("season_id", seasonId)
      .in("rider_id", riderIds)
      .returns<RiderSeasonSummaryRow[]>(),
  ]);

  if (ridersResult.error) {
    throw new Error(
      `Impossible de charger les nationalités de l'effectif : ${ridersResult.error.message}`
    );
  }

  if (summariesResult.error) {
    throw new Error(
      `Impossible de charger le classement des leaders : ${summariesResult.error.message}`
    );
  }

  for (const rider of ridersResult.data ?? []) {
    countryIds.add(rider.country_id);
  }

  const { data: countryRows, error: countriesError } = await supabase
    .from("countries")
    .select("id, iso_alpha2")
    .in("id", [...countryIds])
    .returns<CountryRow[]>();

  if (countriesError) {
    throw new Error(
      `Impossible de charger les pays liés à l'équipe : ${countriesError.message}`
    );
  }

  const countryCodeById = new Map(
    (countryRows ?? []).map((country) => [
      country.id,
      country.iso_alpha2.trim().toUpperCase(),
    ])
  );
  const teamCountryCode = countryCodeById.get(teamResult.data.home_country_id);

  if (!teamCountryCode) {
    throw new Error("Le pays fondateur de l'équipe est introuvable.");
  }

  const countryCodeByRiderId = new Map(
    (ridersResult.data ?? []).flatMap((rider) => {
      const countryCode = countryCodeById.get(rider.country_id);
      return countryCode ? [[rider.id, countryCode] as const] : [];
    })
  );
  const pointsByRiderId = new Map(
    (summariesResult.data ?? []).map((summary) => [
      summary.rider_id,
      Math.max(0, Number(summary.points ?? 0) || 0),
    ])
  );

  const leaderCountryCodes = [
    ...new Set(
      [...pointsByRiderId.entries()]
        .filter(([, points]) => points > 0)
        .sort(
          ([firstRiderId, firstPoints], [secondRiderId, secondPoints]) =>
            secondPoints - firstPoints || firstRiderId.localeCompare(secondRiderId)
        )
        .flatMap(([riderId]) => {
          const countryCode = countryCodeByRiderId.get(riderId);
          return countryCode ? [countryCode] : [];
        })
    ),
  ].slice(0, LEADER_COUNTRY_COUNT);

  const rosterCountryStats = new Map<
    string,
    { riderCount: number; uciPoints: number }
  >();

  for (const riderId of riderIds) {
    const countryCode = countryCodeByRiderId.get(riderId);
    if (!countryCode) continue;
    const current = rosterCountryStats.get(countryCode) ?? {
      riderCount: 0,
      uciPoints: 0,
    };
    current.riderCount += 1;
    current.uciPoints += pointsByRiderId.get(riderId) ?? 0;
    rosterCountryStats.set(countryCode, current);
  }

  const rosterMajorityCountryCode =
    [...rosterCountryStats.entries()].sort(
      ([firstCode, first], [secondCode, second]) =>
        second.riderCount - first.riderCount ||
        second.uciPoints - first.uciPoints ||
        firstCode.localeCompare(secondCode)
    )[0]?.[0] ?? null;

  return {
    teamCountryCode,
    leaderCountryCodes,
    rosterMajorityCountryCode,
    preferredSponsorIds,
  };
}

async function loadCountryCode({
  supabase,
  countryId,
}: {
  supabase: SupabaseAdminClient;
  countryId: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("countries")
    .select("id, iso_alpha2")
    .eq("id", countryId)
    .maybeSingle<CountryRow>();

  if (error || !data) {
    throw new Error("Le pays fondateur de l'équipe est introuvable.");
  }

  return data.iso_alpha2.trim().toUpperCase();
}
