import "server-only";

import { SPONSORS } from "@/data/sponsors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateSponsorOffersForAuthUser,
  type PersistedSponsorOffer,
} from "@/services/persisted-sponsor-offers";
import type { Sponsor } from "@/types/sponsor";

export type SponsorJerseyStyle =
  | "classic"
  | "modern"
  | "bold";

export type SponsorContractObjective = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: string;
};

export type PersistedSponsorContract = {
  id: string;
  sponsor: Sponsor;
  sponsorOfferId: string;
  budgetPerSeason: number;
  currencyCode: string;
  contractDurationSeasons: number;
  status: "planned" | "active";
  selectedJerseyId: string | null;
  selectedJerseyStyle: SponsorJerseyStyle | null;
  signedAt: string | null;
  activatedAt: string | null;
  objectives: SponsorContractObjective[];
};

export type SponsoringState =
  | {
      kind: "offers";
      offers: PersistedSponsorOffer[];
    }
  | {
      kind: "jersey-selection";
      contract: PersistedSponsorContract;
    }
  | {
      kind: "active";
      contract: PersistedSponsorContract;
    };

type SportingDirectorRow = {
  id: string;
};

type TeamAssignmentRow = {
  team_id: string;
};

type SponsorContractRow = {
  id: string;
  sponsor_id: string;
  sponsor_offer_id: string | null;
  budget_per_season: number | string;
  currency_code: string;
  contract_duration_seasons: number;
  status: "planned" | "active";
  selected_jersey_id: string | null;
  selected_jersey_style:
    | SponsorJerseyStyle
    | null;
  signed_at: string | null;
  activated_at: string | null;
};

type SponsorRegistryRow = {
  catalog_key: string;
};

type SponsorObjectiveRow = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  status: string;
};

export async function getSponsoringStateForAuthUser(
  authUserId: string
): Promise<SponsoringState> {
  const normalizedAuthUserId = authUserId.trim();

  if (!normalizedAuthUserId) {
    throw new Error(
      "L’identifiant du joueur authentifié est obligatoire."
    );
  }

  const supabase = createSupabaseAdminClient();

  const {
    data: sportingDirector,
    error: sportingDirectorError,
  } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", normalizedAuthUserId)
    .eq("status", "active")
    .maybeSingle<SportingDirectorRow>();

  if (
    sportingDirectorError ||
    !sportingDirector
  ) {
    throw new Error(
      "Impossible de retrouver le profil du Directeur Sportif."
    );
  }

  const {
    data: teamAssignment,
    error: teamAssignmentError,
  } = await supabase
    .from("team_manager_assignments")
    .select("team_id")
    .eq(
      "sporting_director_id",
      sportingDirector.id
    )
    .eq("role", "general_manager")
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle<TeamAssignmentRow>();

  if (
    teamAssignmentError ||
    !teamAssignment
  ) {
    throw new Error(
      "Aucune équipe active n’est rattachée à ce Directeur Sportif."
    );
  }

  const {
    data: contractRow,
    error: contractError,
  } = await supabase
    .from("team_sponsor_contracts")
    .select(
      `
        id,
        sponsor_id,
        sponsor_offer_id,
        budget_per_season,
        currency_code,
        contract_duration_seasons,
        status,
        selected_jersey_id,
        selected_jersey_style,
        signed_at,
        activated_at
      `
    )
    .eq("team_id", teamAssignment.team_id)
    .eq("role", "principal")
    .in("status", ["planned", "active"])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle<SponsorContractRow>();

  if (contractError) {
    throw new Error(
      `Impossible de charger le contrat sponsor : ${contractError.message}`
    );
  }

  if (!contractRow) {
    const offers =
      await getOrCreateSponsorOffersForAuthUser(
        normalizedAuthUserId
      );

    return {
      kind: "offers",
      offers,
    };
  }

  if (!contractRow.sponsor_offer_id) {
    throw new Error(
      "Le contrat sponsor actif n’est relié à aucune offre."
    );
  }

  const [
    sponsorRegistryResult,
    objectivesResult,
  ] = await Promise.all([
    supabase
      .from("sponsors")
      .select("catalog_key")
      .eq("id", contractRow.sponsor_id)
      .maybeSingle<SponsorRegistryRow>(),

    supabase
      .from("sponsor_objectives")
      .select(
        `
          id,
          name,
          description,
          display_order,
          status
        `
      )
      .eq(
        "sponsor_offer_id",
        contractRow.sponsor_offer_id
      )
      .order("display_order", {
        ascending: true,
      })
      .returns<SponsorObjectiveRow[]>(),
  ]);

  if (
    sponsorRegistryResult.error ||
    !sponsorRegistryResult.data
  ) {
    throw new Error(
      "Impossible de retrouver le sponsor associé au contrat."
    );
  }

  if (objectivesResult.error) {
    throw new Error(
      `Impossible de charger les objectifs du contrat : ${objectivesResult.error.message}`
    );
  }

 const sponsorCatalogKey =
  sponsorRegistryResult.data.catalog_key;

const sponsor = SPONSORS.find(
  (catalogSponsor) =>
    catalogSponsor.id === sponsorCatalogKey
);

if (!sponsor) {
  throw new Error(
    `Le sponsor "${sponsorCatalogKey}" existe dans Supabase mais pas dans le catalogue TypeScript.`
  );
}

  const budgetPerSeason = Number(
    contractRow.budget_per_season
  );

  if (!Number.isFinite(budgetPerSeason)) {
    throw new Error(
      "Le budget du contrat sponsor est invalide."
    );
  }

  const contract: PersistedSponsorContract = {
    id: contractRow.id,
    sponsor,
    sponsorOfferId:
      contractRow.sponsor_offer_id,
    budgetPerSeason,
    currencyCode: contractRow.currency_code,
    contractDurationSeasons:
      contractRow.contract_duration_seasons,
    status: contractRow.status,
    selectedJerseyId:
      contractRow.selected_jersey_id,
    selectedJerseyStyle:
      contractRow.selected_jersey_style,
    signedAt: contractRow.signed_at,
    activatedAt: contractRow.activated_at,
    objectives: (
      objectivesResult.data ?? []
    ).map((objective) => ({
      id: objective.id,
      name: objective.name,
      description: objective.description,
      displayOrder: objective.display_order,
      status: objective.status,
    })),
  };

  if (
    contract.status === "planned" ||
    !contract.selectedJerseyId ||
    !contract.selectedJerseyStyle
  ) {
    return {
      kind: "jersey-selection",
      contract,
    };
  }

  return {
    kind: "active",
    contract,
  };
}