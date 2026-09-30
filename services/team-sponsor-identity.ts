import "server-only";

import { SPONSORS } from "@/data/sponsors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  SecondarySponsorIdentity,
  SecondarySponsorLogoPlacement,
  SecondarySponsorLogoVariant,
} from "@/lib/game/secondary-sponsor";
import type { Sponsor } from "@/types/sponsor";

export type TeamSponsorIdentity = {
  contractId: string | null;
  teamId: string;
  teamName: string;
  teamShortName: string | null;

  sponsor: Sponsor;
  selectedJersey: Sponsor["jerseys"][number];
  secondarySponsor: SecondarySponsorIdentity | null;
  secondaryLogoPlacement: SecondarySponsorLogoPlacement | null;

  budgetPerSeason: number;
  currencyCode: string;
  contractDurationSeasons: number;
};

type SupabaseAdminClient = ReturnType<
  typeof createSupabaseAdminClient
>;

type SportingDirectorRow = {
  id: string;
};

type TeamAssignmentRow = {
  team_id: string;
};

type InitialCareerGenerationRow = {
  team_id: string;
};

type ActiveSeasonRow = {
  id: string;
};

type SponsorContractRow = {
  id: string;
  sponsor_id: string;
  selected_jersey_id: string | null;
  budget_per_season: number | string;
  currency_code: string;
  contract_duration_seasons: number;
  start_season_id: string;
};

type SponsorRegistryRow = {
  catalog_key: string;
};

type TeamSeasonRow = {
  display_name: string;
  short_name: string | null;
};

type SecondaryContractRow = {
  secondary_sponsor_id: string;
  logo_x_percent: number | string;
  logo_y_percent: number | string;
  logo_scale: number | string;
  logo_rotation_degrees: number | string;
};

type SecondaryCatalogRow = {
  id: string;
  country_id: string;
  name: string;
  prestige: number;
  primary_color: string;
  accent_color: string;
  logo_variant: SecondarySponsorLogoVariant;
};

type CountryRow = { name: string; iso_alpha2: string };

export async function getActiveTeamSponsorIdentityForAuthUser(
  authUserId: string
): Promise<TeamSponsorIdentity | null> {
  const normalizedAuthUserId =
    authUserId.trim();

  if (!normalizedAuthUserId) {
    throw new Error(
      "L’identifiant du joueur authentifié est obligatoire."
    );
  }

  const supabase =
    createSupabaseAdminClient();

  const {
    data: sportingDirector,
    error: sportingDirectorError,
  } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq(
      "auth_user_id",
      normalizedAuthUserId
    )
    .eq("status", "active")
    .maybeSingle<SportingDirectorRow>();

  if (sportingDirectorError) {
    throw new Error(
      `Impossible de retrouver le Directeur Sportif : ${sportingDirectorError.message}`
    );
  }

  if (!sportingDirector) {
    return null;
  }

  const teamId =
    await resolveCurrentTeamId({
      supabase,
      sportingDirectorId:
        sportingDirector.id,
    });

  if (!teamId) {
    return null;
  }

  return getActiveTeamSponsorIdentity(teamId);
}

export async function getActiveTeamSponsorIdentity(
  teamId: string
): Promise<TeamSponsorIdentity | null> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) {
    return null;
  }

  const supabase = createSupabaseAdminClient();

  const {
    data: contractRows,
    error: contractError,
  } = await supabase
    .from("team_sponsor_contracts")
    .select(
      `
        id,
        sponsor_id,
        selected_jersey_id,
        budget_per_season,
        currency_code,
        contract_duration_seasons,
        start_season_id
      `
    )
    .eq("team_id", normalizedTeamId)
    .eq("role", "principal")
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .returns<SponsorContractRow[]>();

  if (contractError) {
    throw new Error(
      `Impossible de charger le sponsor actif : ${contractError.message}`
    );
  }

  const contract =
    contractRows?.[0] ?? null;

  if (
    !contract ||
    !contract.selected_jersey_id
  ) {
    return null;
  }

  const [
    sponsorRegistryResult,
    activeSeasonResult,
  ] = await Promise.all([
    supabase
      .from("sponsors")
      .select("catalog_key")
      .eq("id", contract.sponsor_id)
      .maybeSingle<SponsorRegistryRow>(),

    supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<ActiveSeasonRow>(),
  ]);

  if (sponsorRegistryResult.error) {
    throw new Error(
      `Impossible de retrouver le sponsor : ${sponsorRegistryResult.error.message}`
    );
  }

  if (!sponsorRegistryResult.data) {
    throw new Error(
      "Le sponsor actif est absent du registre."
    );
  }

  if (activeSeasonResult.error) {
    throw new Error(
      `Impossible de retrouver la saison active : ${activeSeasonResult.error.message}`
    );
  }

  const sponsorCatalogKey =
    sponsorRegistryResult.data.catalog_key;

  const sponsor = SPONSORS.find(
    (catalogSponsor) =>
      catalogSponsor.id ===
      sponsorCatalogKey
  );

  if (!sponsor) {
    throw new Error(
      `Le sponsor "${sponsorCatalogKey}" est absent du catalogue TypeScript.`
    );
  }

  const selectedJersey =
    sponsor.jerseys.find(
      (jersey) =>
        jersey.id ===
        contract.selected_jersey_id
    );

  if (!selectedJersey) {
    throw new Error(
      `Le maillot "${contract.selected_jersey_id}" est absent du catalogue du sponsor.`
    );
  }

  const seasonId =
    activeSeasonResult.data?.id ??
    contract.start_season_id;

  const {
    data: teamSeason,
    error: teamSeasonError,
  } = await supabase
    .from("team_seasons")
    .select(
      `
        display_name,
        short_name
      `
    )
    .eq("team_id", normalizedTeamId)
    .eq("season_id", seasonId)
    .maybeSingle<TeamSeasonRow>();

  if (teamSeasonError) {
    throw new Error(
      `Impossible de charger l’identité de l’équipe : ${teamSeasonError.message}`
    );
  }

  const secondaryIdentity = await loadActiveSecondaryIdentity({
    supabase,
    teamId: normalizedTeamId,
    seasonId,
  });

  const budgetPerSeason = Number(
    contract.budget_per_season
  );

  if (!Number.isFinite(budgetPerSeason)) {
    throw new Error(
      "Le budget du sponsor actif est invalide."
    );
  }

  return {
    contractId: contract.id,
    teamId: normalizedTeamId,

    teamName:
      teamSeason?.display_name ??
      sponsor.name,

    teamShortName:
      teamSeason?.short_name ??
      sponsor.shortName,

    sponsor,
    selectedJersey,
    secondarySponsor: secondaryIdentity?.sponsor ?? null,
    secondaryLogoPlacement: secondaryIdentity?.placement ?? null,

    budgetPerSeason,
    currencyCode:
      contract.currency_code,

    contractDurationSeasons:
      contract.contract_duration_seasons,
  };
}

async function loadActiveSecondaryIdentity({
  supabase,
  teamId,
  seasonId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  seasonId: string;
}): Promise<{
  sponsor: SecondarySponsorIdentity;
  placement: SecondarySponsorLogoPlacement;
} | null> {
  const { data: contract, error: contractError } = await supabase
    .from("secondary_sponsor_contracts")
    .select(
      "secondary_sponsor_id, logo_x_percent, logo_y_percent, logo_scale, logo_rotation_degrees",
    )
    .eq("team_id", teamId)
    .eq("season_id", seasonId)
    .eq("status", "active")
    .maybeSingle<SecondaryContractRow>();

  if (contractError) {
    throw new Error(
      `Impossible de charger le sponsor secondaire actif : ${contractError.message}`,
    );
  }
  if (!contract) return null;

  const { data: catalog, error: catalogError } = await supabase
    .from("secondary_sponsor_catalog")
    .select(
      "id, country_id, name, prestige, primary_color, accent_color, logo_variant",
    )
    .eq("id", contract.secondary_sponsor_id)
    .maybeSingle<SecondaryCatalogRow>();

  if (catalogError || !catalog) {
    throw new Error("Le sponsor secondaire actif est absent du catalogue.");
  }

  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("name, iso_alpha2")
    .eq("id", catalog.country_id)
    .maybeSingle<CountryRow>();

  if (countryError || !country) {
    throw new Error("Le pays du sponsor secondaire actif est indisponible.");
  }

  return {
    sponsor: {
      id: catalog.id,
      name: catalog.name,
      countryCode: country.iso_alpha2,
      countryName: country.name,
      prestige:
        catalog.prestige <= 1
          ? 1
          : catalog.prestige === 2
            ? 2
            : catalog.prestige === 3
              ? 3
              : catalog.prestige === 4
                ? 4
                : 5,
      primaryColor: catalog.primary_color,
      accentColor: catalog.accent_color,
      logoVariant: catalog.logo_variant,
    },
    placement: {
      xPercent: Number(contract.logo_x_percent),
      yPercent: Number(contract.logo_y_percent),
      scale: Number(contract.logo_scale),
      rotationDegrees: Number(contract.logo_rotation_degrees),
    },
  };
}

async function resolveCurrentTeamId({
  supabase,
  sportingDirectorId,
}: {
  supabase: SupabaseAdminClient;
  sportingDirectorId: string;
}): Promise<string | null> {
  const {
    data: assignmentRows,
    error: assignmentError,
  } = await supabase
    .from("team_manager_assignments")
    .select("team_id")
    .eq(
      "sporting_director_id",
      sportingDirectorId
    )
    .eq("role", "general_manager")
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .returns<TeamAssignmentRow[]>();

  if (assignmentError) {
    throw new Error(
      `Impossible de charger l’affectation de l’équipe : ${assignmentError.message}`
    );
  }

  const assignedTeamId =
    assignmentRows?.[0]?.team_id;

  if (assignedTeamId) {
    return assignedTeamId;
  }

  const {
    data: careerGeneration,
    error: careerGenerationError,
  } = await supabase
    .from("initial_career_generations")
    .select("team_id")
    .eq(
      "sporting_director_id",
      sportingDirectorId
    )
    .maybeSingle<InitialCareerGenerationRow>();

  if (careerGenerationError) {
    throw new Error(
      `Impossible de retrouver l’équipe générée : ${careerGenerationError.message}`
    );
  }

  return careerGeneration?.team_id ?? null;
}
