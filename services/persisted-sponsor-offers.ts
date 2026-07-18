import "server-only";

import { SPONSORS } from "@/data/sponsors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ensureAndLoadSponsorObjectives,
  type SponsorOfferObjectiveContext,
} from "@/services/persisted-sponsor-objectives";
import { generateSponsorProposals } from "@/services/sponsor-proposals";
import type { Sponsor } from "@/types/sponsor";
import type { PersistedSponsorObjective } from "@/types/sponsor-objective";

const DEFAULT_PROPOSAL_COUNT = 3;

export type SponsorOfferStatus =
  | "draft"
  | "open"
  | "accepted"
  | "expired"
  | "withdrawn";

export type PersistedSponsorOffer = {
  id: string;
  sponsor: Sponsor;
  proposedBudget: number;
  contractDurationSeasons: number;
  status: SponsorOfferStatus;
  objectives: PersistedSponsorObjective[];
};

type SupabaseAdminClient = ReturnType<
  typeof createSupabaseAdminClient
>;

type HydratedSponsorOfferWithoutObjectives = Omit<
  PersistedSponsorOffer,
  "objectives"
>;

type SportingDirectorRow = {
  id: string;
  country_id: string | null;
  reputation_points: number;
};

type CountryRow = {
  iso_alpha2: string;
};

type SeasonRow = {
  id: string;
  game_year: number;
};

type SponsorRegistryRow = {
  id: string;
  catalog_key: string;
};

type SponsorOfferRow = {
  id: string;
  sponsor_id: string;
  budget_per_season: number | string;
  contract_duration_seasons: number;
  status: SponsorOfferStatus;
};

type SponsorContractRow = {
  sponsor_id: string;
  start_season_id: string;
  end_season_id: string;
};

type ContractSeasonRow = {
  id: string;
  game_year: number;
};

export async function getOrCreateSponsorOffersForAuthUser(
  authUserId: string
): Promise<PersistedSponsorOffer[]> {
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
    .select("id, country_id, reputation_points")
    .eq("auth_user_id", normalizedAuthUserId)
    .maybeSingle<SportingDirectorRow>();

  if (sportingDirectorError || !sportingDirector) {
    throw new Error(
      "Impossible de retrouver le profil du Directeur Sportif."
    );
  }

  if (!sportingDirector.country_id) {
    throw new Error(
      "Le Directeur Sportif doit choisir sa nationalité avant de recevoir des offres."
    );
  }

  const [
    activeSeasonResult,
    directorCountryResult,
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, game_year")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),

    supabase
      .from("countries")
      .select("iso_alpha2")
      .eq("id", sportingDirector.country_id)
      .maybeSingle<CountryRow>(),
  ]);

  if (
    activeSeasonResult.error ||
    !activeSeasonResult.data
  ) {
    throw new Error(
      "Aucune saison active n’est disponible."
    );
  }

  if (
    directorCountryResult.error ||
    !directorCountryResult.data
  ) {
    throw new Error(
      "Impossible de retrouver la nationalité du Directeur Sportif."
    );
  }

  const activeSeason = activeSeasonResult.data;
  const directorCountry = directorCountryResult.data;

  const {
    data: existingOfferRows,
    error: existingOffersError,
  } = await supabase
    .from("sponsor_offers")
    .select(
      `
        id,
        sponsor_id,
        budget_per_season,
        contract_duration_seasons,
        status
      `
    )
    .eq(
      "sporting_director_id",
      sportingDirector.id
    )
    .eq("season_id", activeSeason.id)
    .in("status", ["draft", "open"])
    .order("created_at", {
      ascending: true,
    })
    .returns<SponsorOfferRow[]>();

  if (existingOffersError) {
    throw new Error(
      `Impossible de récupérer les offres existantes : ${existingOffersError.message}`
    );
  }

  if (
    existingOfferRows &&
    existingOfferRows.length > 0
  ) {
    return hydrateSponsorOffersWithObjectives({
      supabase,
      seasonId: activeSeason.id,
      offerRows: existingOfferRows,
    });
  }

  const unavailableSponsorIds =
    await getUnavailableSponsorCatalogKeys(
      supabase,
      activeSeason
    );

  const generatedProposals =
    generateSponsorProposals({
      directorCountryCode:
        directorCountry.iso_alpha2,
      directorReputation:
        sportingDirector.reputation_points,
      unavailableSponsorIds,
      proposalCount: DEFAULT_PROPOSAL_COUNT,
    });

  if (
    generatedProposals.length <
    DEFAULT_PROPOSAL_COUNT
  ) {
    throw new Error(
      `Le catalogue ne contient que ${generatedProposals.length} sponsor(s) éligible(s), alors que ${DEFAULT_PROPOSAL_COUNT} offres sont nécessaires.`
    );
  }

  const proposedCatalogKeys =
    generatedProposals.map(
      (proposal) => proposal.sponsor.id
    );

  const {
    data: sponsorRegistryRows,
    error: sponsorRegistryError,
  } = await supabase
    .from("sponsors")
    .select("id, catalog_key")
    .in("catalog_key", proposedCatalogKeys)
    .eq("status", "active")
    .returns<SponsorRegistryRow[]>();

  if (sponsorRegistryError) {
    throw new Error(
      `Impossible de retrouver le registre des sponsors : ${sponsorRegistryError.message}`
    );
  }

  const sponsorRegistryByCatalogKey = new Map(
    (sponsorRegistryRows ?? []).map((sponsor) => [
      sponsor.catalog_key,
      sponsor.id,
    ])
  );

  const missingCatalogKeys =
    proposedCatalogKeys.filter(
      (catalogKey) =>
        !sponsorRegistryByCatalogKey.has(catalogKey)
    );

  if (missingCatalogKeys.length > 0) {
    throw new Error(
      `Sponsors absents du registre Supabase : ${missingCatalogKeys.join(
        ", "
      )}. Lance npm run sponsors:sync.`
    );
  }

  const availableFrom = new Date().toISOString();

  const offerRowsToInsert =
    generatedProposals.map((proposal) => {
      const sponsorRegistryId =
        sponsorRegistryByCatalogKey.get(
          proposal.sponsor.id
        );

      if (!sponsorRegistryId) {
        throw new Error(
          `Identifiant Supabase introuvable pour ${proposal.sponsor.id}.`
        );
      }

      return {
        sponsor_id: sponsorRegistryId,
        season_id: activeSeason.id,
        sporting_director_id:
          sportingDirector.id,
        title: `Proposition de ${proposal.sponsor.name}`,
        description:
          proposal.sponsor.description,
        budget_per_season:
          proposal.proposedBudget,
        currency_code: "EUR",
        contract_duration_seasons:
          proposal.contractDurationSeasons,
        available_from: availableFrom,
        available_until: null,
        status: "open",
      };
    });

  const {
    data: insertedOfferRows,
    error: insertOffersError,
  } = await supabase
    .from("sponsor_offers")
    .insert(offerRowsToInsert)
    .select(
      `
        id,
        sponsor_id,
        budget_per_season,
        contract_duration_seasons,
        status
      `
    )
    .returns<SponsorOfferRow[]>();

  if (insertOffersError) {
    throw new Error(
      `Impossible d’enregistrer les offres : ${insertOffersError.message}`
    );
  }

  return hydrateSponsorOffersWithObjectives({
    supabase,
    seasonId: activeSeason.id,
    offerRows: insertedOfferRows ?? [],
  });
}

async function hydrateSponsorOffersWithObjectives({
  supabase,
  seasonId,
  offerRows,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
  offerRows: readonly SponsorOfferRow[];
}): Promise<PersistedSponsorOffer[]> {
  const hydratedOffers =
    await hydrateSponsorOffers(
      supabase,
      offerRows
    );

  const objectiveContexts:
    SponsorOfferObjectiveContext[] =
    hydratedOffers.map((offer) => ({
      offerId: offer.id,
      sponsor: offer.sponsor,
    }));

  const objectivesByOfferId =
    await ensureAndLoadSponsorObjectives({
      supabase,
      seasonId,
      offers: objectiveContexts,
    });

  return hydratedOffers.map((offer) => {
    const objectives =
      objectivesByOfferId.get(offer.id);

    if (!objectives) {
      throw new Error(
        `Les objectifs de l’offre ${offer.id} sont introuvables.`
      );
    }

    return {
      ...offer,
      objectives,
    };
  });
}

async function getUnavailableSponsorCatalogKeys(
  supabase: SupabaseAdminClient,
  activeSeason: SeasonRow
): Promise<string[]> {
  const {
    data: contractRows,
    error: contractsError,
  } = await supabase
    .from("team_sponsor_contracts")
    .select(
      `
        sponsor_id,
        start_season_id,
        end_season_id
      `
    )
    .eq("role", "principal")
    .in("status", ["planned", "active"])
    .returns<SponsorContractRow[]>();

  if (contractsError) {
    throw new Error(
      `Impossible de vérifier les contrats de sponsoring : ${contractsError.message}`
    );
  }

  if (!contractRows || contractRows.length === 0) {
    return [];
  }

  const contractSeasonIds = [
    ...new Set(
      contractRows.flatMap((contract) => [
        contract.start_season_id,
        contract.end_season_id,
      ])
    ),
  ];

  const {
    data: contractSeasonRows,
    error: contractSeasonsError,
  } = await supabase
    .from("seasons")
    .select("id, game_year")
    .in("id", contractSeasonIds)
    .returns<ContractSeasonRow[]>();

  if (contractSeasonsError) {
    throw new Error(
      `Impossible de vérifier les saisons des contrats : ${contractSeasonsError.message}`
    );
  }

  const gameYearBySeasonId = new Map(
    (contractSeasonRows ?? []).map((season) => [
      season.id,
      season.game_year,
    ])
  );

  const unavailableSponsorRegistryIds =
    contractRows
      .filter((contract) => {
        const startGameYear =
          gameYearBySeasonId.get(
            contract.start_season_id
          );

        const endGameYear =
          gameYearBySeasonId.get(
            contract.end_season_id
          );

        if (
          startGameYear === undefined ||
          endGameYear === undefined
        ) {
          return false;
        }

        return (
          startGameYear <= activeSeason.game_year &&
          endGameYear >= activeSeason.game_year
        );
      })
      .map((contract) => contract.sponsor_id);

  if (
    unavailableSponsorRegistryIds.length === 0
  ) {
    return [];
  }

  const {
    data: unavailableSponsorRows,
    error: unavailableSponsorsError,
  } = await supabase
    .from("sponsors")
    .select("id, catalog_key")
    .in("id", unavailableSponsorRegistryIds)
    .returns<SponsorRegistryRow[]>();

  if (unavailableSponsorsError) {
    throw new Error(
      `Impossible de retrouver les sponsors indisponibles : ${unavailableSponsorsError.message}`
    );
  }

  return (unavailableSponsorRows ?? []).map(
    (sponsor) => sponsor.catalog_key
  );
}

async function hydrateSponsorOffers(
  supabase: SupabaseAdminClient,
  offerRows: readonly SponsorOfferRow[]
): Promise<
  HydratedSponsorOfferWithoutObjectives[]
> {
  if (offerRows.length === 0) {
    return [];
  }

  const sponsorRegistryIds = [
    ...new Set(
      offerRows.map((offer) => offer.sponsor_id)
    ),
  ];

  const {
    data: sponsorRegistryRows,
    error: sponsorRegistryError,
  } = await supabase
    .from("sponsors")
    .select("id, catalog_key")
    .in("id", sponsorRegistryIds)
    .returns<SponsorRegistryRow[]>();

  if (sponsorRegistryError) {
    throw new Error(
      `Impossible de charger les sponsors des offres : ${sponsorRegistryError.message}`
    );
  }

  const catalogKeyBySponsorRegistryId =
    new Map(
      (sponsorRegistryRows ?? []).map(
        (sponsor) => [
          sponsor.id,
          sponsor.catalog_key,
        ]
      )
    );

  const sponsorByCatalogKey = new Map(
    SPONSORS.map((sponsor) => [
      sponsor.id,
      sponsor,
    ])
  );

  return offerRows.map((offerRow) => {
    const catalogKey =
      catalogKeyBySponsorRegistryId.get(
        offerRow.sponsor_id
      );

    if (!catalogKey) {
      throw new Error(
        `Clé catalogue introuvable pour le sponsor Supabase ${offerRow.sponsor_id}.`
      );
    }

    const sponsor =
      sponsorByCatalogKey.get(catalogKey);

    if (!sponsor) {
      throw new Error(
        `Le sponsor "${catalogKey}" existe dans Supabase mais pas dans le catalogue TypeScript.`
      );
    }

    const proposedBudget = Number(
      offerRow.budget_per_season
    );

    if (!Number.isFinite(proposedBudget)) {
      throw new Error(
        `Budget invalide pour l’offre ${offerRow.id}.`
      );
    }

    return {
      id: offerRow.id,
      sponsor,
      proposedBudget,
      contractDurationSeasons:
        offerRow.contract_duration_seasons,
      status: offerRow.status,
    };
  });
}