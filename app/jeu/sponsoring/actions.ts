"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  GAMEPLAY_RULES,
  isFutureSponsoringWindowOpen,
  isSponsoringUnlocked,
} from "@/lib/gameplay-rules";
import { SPONSORS } from "@/data/sponsors";
import {
  getSponsorNegotiationBudgetCeiling,
  isSponsorObjectiveDifficulty,
} from "@/lib/game/sponsor-negotiation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAndLoadSponsorObjectives } from "@/services/persisted-sponsor-objectives";
import type { SponsorJerseyStyle } from "@/services/sponsoring-workflow";

const JERSEY_STYLES: readonly SponsorJerseyStyle[] = [
  "classic",
  "modern",
  "bold",
];

const SPONSORING_REVALIDATION_PATHS = [
  "/jeu",
  "/jeu/sponsoring",
  "/jeu/directeur-sportif",
  "/jeu/effectif",
] as const;

export async function negotiateSponsorOfferAction(formData: FormData) {
  const offerId = readRequiredValue(formData, "offerId");
  const objectiveDifficulty = readRequiredValue(
    formData,
    "objectiveDifficulty",
  );

  if (!isUuid(offerId)) {
    redirectWithError("L’offre sélectionnée est invalide.");
  }

  if (!isSponsorObjectiveDifficulty(objectiveDifficulty)) {
    redirectWithError("Le niveau de difficulté sélectionné est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (directorError || !director) {
    redirectWithError("Le profil du Directeur Sportif est indisponible.");
  }

  const admin = createSupabaseAdminClient();
  const { data: offer, error: offerError } = await admin
    .from("sponsor_offers")
    .select(
      "id, sponsor_id, season_id, status, budget_per_season, base_budget_per_season",
    )
    .eq("id", offerId)
    .eq("sporting_director_id", director.id)
    .maybeSingle<{
      id: string;
      sponsor_id: string;
      season_id: string;
      status: string;
      budget_per_season: number | string;
      base_budget_per_season: number | string;
    }>();

  if (offerError || !offer || offer.status !== "open") {
    redirectWithError("Cette offre est introuvable ou n’est plus négociable.");
  }

  const [sponsorResult, seasonResult] = await Promise.all([
    admin
      .from("sponsors")
      .select("catalog_key")
      .eq("id", offer.sponsor_id)
      .maybeSingle<{ catalog_key: string }>(),
    admin
      .from("seasons")
      .select("game_year, status")
      .eq("id", offer.season_id)
      .maybeSingle<{ game_year: number; status: string }>(),
  ]);

  const sponsorRegistry = sponsorResult.data;
  const offerSeason = seasonResult.data;

  if (sponsorResult.error || !sponsorRegistry) {
    redirectWithError("Le sponsor de cette offre est introuvable.");
  }

  if (
    seasonResult.error ||
    !offerSeason ||
    offerSeason.status !== "planned" ||
    offerSeason.game_year < 3
  ) {
    redirectWithError(
      "La négociation des objectifs sera disponible à partir de la saison 3.",
    );
  }

  const sponsor = SPONSORS.find(
    (candidate) => candidate.id === sponsorRegistry.catalog_key,
  );
  const baseBudget = Number(offer.base_budget_per_season);

  if (!sponsor || !Number.isFinite(baseBudget) || baseBudget <= 0) {
    redirectWithError("Les paramètres budgétaires de cette offre sont invalides.");
  }

  const budgetCeiling = getSponsorNegotiationBudgetCeiling({
    baseBudget,
    sponsorMaximumBudget: sponsor.budgetRange.max,
  });
  const { error: negotiationError } = await admin.rpc(
    "negotiate_sponsor_offer",
    {
      p_offer_id: offerId,
      p_sporting_director_id: director.id,
      p_objective_difficulty: objectiveDifficulty,
      p_base_budget: baseBudget,
      p_budget_ceiling: budgetCeiling,
    },
  );

  if (negotiationError) redirectWithError(negotiationError.message);

  revalidateSponsoringPaths();
  redirect("/jeu/sponsoring?succes=negociation");
}

export async function negotiateContinuingSponsorObjectivesAction(
  formData: FormData,
) {
  const contractId = readRequiredValue(formData, "contractId");
  const offerId = readRequiredValue(formData, "offerId");
  const objectiveDifficulty = readRequiredValue(
    formData,
    "objectiveDifficulty",
  );

  if (!isUuid(contractId) || !isUuid(offerId)) {
    redirectWithError("Le contrat sponsor sélectionné est invalide.");
  }

  if (!isSponsorObjectiveDifficulty(objectiveDifficulty)) {
    redirectWithError("Le niveau de difficulté sélectionné est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const admin = createSupabaseAdminClient();
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id, reputation_points")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle<{ id: string; reputation_points: number }>();

  if (directorError || !director) {
    redirectWithError("Le profil du Directeur Sportif est indisponible.");
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", director.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ team_id: string }>();

  if (assignmentError || !assignment) {
    redirectWithError("L’équipe du Directeur Sportif est indisponible.");
  }

  const [contractResult, offerResult, activeSeasonResult] = await Promise.all([
    admin
      .from("team_sponsor_contracts")
      .select(
        "id, sponsor_id, start_season_id, contract_duration_seasons, status, pending_sponsor_offer_id",
      )
      .eq("id", contractId)
      .eq("team_id", assignment.team_id)
      .eq("role", "principal")
      .eq("status", "active")
      .maybeSingle<{
        id: string;
        sponsor_id: string;
        start_season_id: string;
        contract_duration_seasons: number;
        status: "active";
        pending_sponsor_offer_id: string | null;
      }>(),
    admin
      .from("sponsor_offers")
      .select(
        "id, sponsor_id, season_id, continuing_contract_id, status, base_budget_per_season",
      )
      .eq("id", offerId)
      .eq("sporting_director_id", director.id)
      .maybeSingle<{
        id: string;
        sponsor_id: string;
        season_id: string;
        continuing_contract_id: string | null;
        status: string;
        base_budget_per_season: number | string;
      }>(),
    admin
      .from("seasons")
      .select("id, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<{
        id: string;
        game_year: number;
        current_day_number: number | null;
      }>(),
  ]);

  const contract = contractResult.data;
  const offer = offerResult.data;
  const activeSeason = activeSeasonResult.data;

  if (contractResult.error || !contract) {
    redirectWithError("Ce contrat est introuvable ou ne vous appartient pas.");
  }

  if (
    offerResult.error ||
    !offer ||
    offer.status !== "accepted" ||
    offer.continuing_contract_id !== contract.id ||
    offer.sponsor_id !== contract.sponsor_id ||
    contract.pending_sponsor_offer_id !== offer.id
  ) {
    redirectWithError("Les objectifs annuels de ce contrat sont indisponibles.");
  }

  if (
    activeSeasonResult.error ||
    !activeSeason ||
    activeSeason.current_day_number === null ||
    !isFutureSponsoringWindowOpen(activeSeason.current_day_number)
  ) {
    redirectWithError(
      `La renégociation annuelle ouvre au jour ${GAMEPLAY_RULES.futureSponsoringOpeningDay}.`,
    );
  }

  const [targetSeasonResult, startSeasonResult, sponsorResult] =
    await Promise.all([
      admin
        .from("seasons")
        .select("id, game_year, status")
        .eq("id", offer.season_id)
        .maybeSingle<{ id: string; game_year: number; status: string }>(),
      admin
        .from("seasons")
        .select("game_year")
        .eq("id", contract.start_season_id)
        .maybeSingle<{ game_year: number }>(),
      admin
        .from("sponsors")
        .select("catalog_key")
        .eq("id", contract.sponsor_id)
        .maybeSingle<{ catalog_key: string }>(),
    ]);

  const targetSeason = targetSeasonResult.data;
  const startSeason = startSeasonResult.data;
  const sponsorRegistry = sponsorResult.data;

  if (
    targetSeasonResult.error ||
    !targetSeason ||
    targetSeason.status !== "planned" ||
    targetSeason.game_year < 3 ||
    targetSeason.game_year !== activeSeason.game_year + 1
  ) {
    redirectWithError(
      "La renégociation annuelle ne peut concerner que la saison suivante.",
    );
  }

  if (
    startSeasonResult.error ||
    !startSeason ||
    startSeason.game_year + contract.contract_duration_seasons - 1 <
      targetSeason.game_year
  ) {
    redirectWithError("Ce contrat ne couvre pas la saison suivante.");
  }

  if (sponsorResult.error || !sponsorRegistry) {
    redirectWithError("Le sponsor de ce contrat est introuvable.");
  }

  const sponsor = SPONSORS.find(
    (candidate) => candidate.id === sponsorRegistry.catalog_key,
  );
  const baseBudget = Number(offer.base_budget_per_season);

  if (!sponsor || !Number.isFinite(baseBudget) || baseBudget <= 0) {
    redirectWithError("Les paramètres de ce contrat sponsor sont invalides.");
  }

  const budgetCeiling = getSponsorNegotiationBudgetCeiling({
    baseBudget,
    sponsorMaximumBudget: sponsor.budgetRange.max,
  });
  const { error: negotiationError } = await admin.rpc(
    "negotiate_continuing_sponsor_objectives",
    {
      p_contract_id: contract.id,
      p_sporting_director_id: director.id,
      p_objective_difficulty: objectiveDifficulty,
      p_base_budget: baseBudget,
      p_budget_ceiling: budgetCeiling,
    },
  );

  if (negotiationError) redirectWithError(negotiationError.message);

  await ensureAndLoadSponsorObjectives({
    supabase: admin,
    seasonId: targetSeason.id,
    teamReputationPoints: director.reputation_points,
    teamId: assignment.team_id,
    offers: [
      {
        offerId: offer.id,
        sponsor,
        proposedBudget: baseBudget,
        relationshipYear: Math.max(
          2,
          targetSeason.game_year - startSeason.game_year + 1,
        ),
        objectiveDifficulty,
        includeRiderRecruitmentObjective: true,
      },
    ],
  });

  revalidateSponsoringPaths();
  redirect("/jeu/sponsoring?succes=negociation-annuelle");
}

export async function signSponsorOfferAction(
  formData: FormData
) {
  const offerId = readRequiredValue(
    formData,
    "offerId"
  );

  if (!isUuid(offerId)) {
    redirectWithError(
      "L’offre sélectionnée est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("id, reputation_points")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle<{ id: string; reputation_points: number }>();

  if (directorError || !director) {
    redirectWithError(
      "Le profil du Directeur Sportif est indisponible."
    );
  }

  if (!isSponsoringUnlocked(director.reputation_points)) {
    redirectWithError(
      `Le marché du sponsoring se débloque à ${GAMEPLAY_RULES.sponsoringUnlockReputation} points de réputation.`
    );
  }

  const [offerResult, activeSeasonResult] = await Promise.all([
    supabase
      .from("sponsor_offers")
      .select("season_id")
      .eq("id", offerId)
      .eq("sporting_director_id", director.id)
      .maybeSingle<{ season_id: string }>(),
    supabase
      .from("seasons")
      .select("id, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<{
        id: string;
        game_year: number;
        current_day_number: number | null;
      }>(),
  ]);

  if (offerResult.error || !offerResult.data) {
    redirectWithError(
      "Cette offre est introuvable ou ne vous appartient pas."
    );
  }

  if (activeSeasonResult.error || !activeSeasonResult.data) {
    redirectWithError("La saison active est indisponible.");
  }

  if (
    activeSeasonResult.data.current_day_number === null ||
    !isFutureSponsoringWindowOpen(
      activeSeasonResult.data.current_day_number
    )
  ) {
    redirectWithError(
      `Les trois offres sponsor de la saison suivante seront accessibles à partir du jour ${GAMEPLAY_RULES.futureSponsoringOpeningDay}.`
    );
  }

  const { data: offerSeason, error: offerSeasonError } = await supabase
    .from("seasons")
    .select("game_year, status")
    .eq("id", offerResult.data.season_id)
    .maybeSingle<{ game_year: number; status: string }>();

  if (
    offerSeasonError ||
    !offerSeason ||
    offerSeason.status !== "planned" ||
    offerSeason.game_year !== activeSeasonResult.data.game_year + 1
  ) {
    redirectWithError(
      "Une offre sponsor ne peut désormais être signée que pour la saison suivante. Votre équipe reste amateur pendant la saison en cours."
    );
  }

  const { error } = await supabase.rpc(
    "sign_sponsor_offer",
    {
      p_offer_id: offerId,
    }
  );

  if (error) {
    redirectWithError(error.message);
  }

  revalidateSponsoringPaths();

  redirect("/jeu/sponsoring");
}

export async function validateSponsorJerseyAction(
  formData: FormData
) {
  const contractId = readRequiredValue(
    formData,
    "contractId"
  );

  const jerseyId = readRequiredValue(
    formData,
    "jerseyId"
  );

  const jerseyStyleValue = readRequiredValue(
    formData,
    "jerseyStyle"
  );

  if (!isUuid(contractId)) {
    redirectWithError(
      "Le contrat sélectionné est invalide."
    );
  }

  if (!jerseyId) {
    redirectWithError(
      "Vous devez sélectionner un maillot."
    );
  }

  if (
    !isSponsorJerseyStyle(jerseyStyleValue)
  ) {
    redirectWithError(
      "Le style de maillot sélectionné est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "validate_sponsor_jersey",
    {
      p_contract_id: contractId,
      p_jersey_id: jerseyId,
      p_jersey_style: jerseyStyleValue,
    }
  );

  if (error) {
    redirectWithError(error.message);
  }

  revalidateSponsoringPaths();

  redirect("/jeu/sponsoring");
}

export async function selectNextSeasonSponsorJerseyAction(
  formData: FormData
) {
  const contractId = readRequiredValue(formData, "contractId");
  const jerseyId = readRequiredValue(formData, "jerseyId");
  const jerseyStyleValue = readRequiredValue(formData, "jerseyStyle");

  if (!isUuid(contractId)) {
    redirectWithError("Le contrat sélectionné est invalide.");
  }

  if (!jerseyId) {
    redirectWithError("Vous devez sélectionner un maillot.");
  }

  if (!isSponsorJerseyStyle(jerseyStyleValue)) {
    redirectWithError("Le style de maillot sélectionné est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "select_next_season_sponsor_jersey",
    {
      p_contract_id: contractId,
      p_jersey_id: jerseyId,
      p_jersey_style: jerseyStyleValue,
    }
  );

  if (error) {
    redirectWithError(error.message);
  }

  revalidateSponsoringPaths();
  redirect("/jeu/sponsoring?succes=maillot-saison");
}

export async function terminateSponsorContractAction(
  formData: FormData
) {
  const contractId = readRequiredValue(
    formData,
    "contractId"
  );

  if (!isUuid(contractId)) {
    redirectWithError(
      "Le contrat sélectionné est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "terminate_active_sponsor_contract",
    {
      p_contract_id: contractId,
    }
  );

  if (error) {
    redirectWithError(error.message);
  }

  revalidateSponsoringPaths();

  redirect(
    "/jeu/sponsoring?succes=rupture"
  );
}

function revalidateSponsoringPaths() {
  for (const path of
    SPONSORING_REVALIDATION_PATHS) {
    revalidatePath(path);
  }
}

function readRequiredValue(
  formData: FormData,
  key: string
): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isSponsorJerseyStyle(
  value: string
): value is SponsorJerseyStyle {
  return JERSEY_STYLES.includes(
    value as SponsorJerseyStyle
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function redirectWithError(
  message: string
): never {
  const normalizedMessage =
    message.trim() ||
    "Une erreur est survenue pendant l’opération.";

  redirect(
    `/jeu/sponsoring?erreur=${encodeURIComponent(
      normalizedMessage
    )}`
  );
}
