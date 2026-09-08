import "server-only";

import { getSponsorsByCountryCode } from "@/data/sponsors/catalog-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationSponsorCoverage = {
  affiliatedSponsorCount: number;
  availableSponsorCount: number;
};

type SponsorContractRow = {
  sponsor_id: string;
};

type SponsorRegistryRow = {
  id: string;
  catalog_key: string;
};

export async function getFederationSponsorCoverage({
  countryCode,
  teamIds,
}: {
  countryCode: string;
  teamIds: readonly string[];
}): Promise<FederationSponsorCoverage> {
  const nationalSponsors = getSponsorsByCountryCode(countryCode);
  const nationalSponsorIds = new Set(
    nationalSponsors.map((sponsor) => sponsor.id),
  );
  const uniqueTeamIds = [
    ...new Set(teamIds.map((teamId) => teamId.trim()).filter(Boolean)),
  ];

  if (uniqueTeamIds.length === 0) {
    return {
      affiliatedSponsorCount: 0,
      availableSponsorCount: nationalSponsors.length,
    };
  }

  const admin = createSupabaseAdminClient();
  const contractsResult = await admin
    .from("team_sponsor_contracts")
    .select("sponsor_id")
    .in("team_id", uniqueTeamIds)
    .eq("role", "principal")
    .eq("status", "active")
    .returns<SponsorContractRow[]>();

  if (contractsResult.error) {
    throw new Error(
      `Impossible de charger les sponsors de la fédération : ${contractsResult.error.message}`,
    );
  }

  const sponsorRegistryIds = [
    ...new Set((contractsResult.data ?? []).map((contract) => contract.sponsor_id)),
  ];
  if (sponsorRegistryIds.length === 0) {
    return {
      affiliatedSponsorCount: 0,
      availableSponsorCount: nationalSponsors.length,
    };
  }

  const sponsorsResult = await admin
    .from("sponsors")
    .select("id, catalog_key")
    .in("id", sponsorRegistryIds)
    .returns<SponsorRegistryRow[]>();

  if (sponsorsResult.error) {
    throw new Error(
      `Impossible d’identifier les sponsors de la fédération : ${sponsorsResult.error.message}`,
    );
  }

  const affiliatedSponsorIds = new Set(
    (sponsorsResult.data ?? [])
      .map((sponsor) => sponsor.catalog_key)
      .filter((catalogKey) => nationalSponsorIds.has(catalogKey)),
  );

  return {
    affiliatedSponsorCount: affiliatedSponsorIds.size,
    availableSponsorCount: nationalSponsors.length,
  };
}
