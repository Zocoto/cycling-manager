import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getScoutedNumericSortValue } from "@/lib/game/transfer-scouting";

import {
  ALPHA_BOT_PROFILES,
  buildAlphaBotCycleKey,
  buildRaceRoster,
  chooseTrainingPlan,
  deterministicIndex,
  type AlphaBotProfile,
  type AlphaBotSlot,
} from "@/lib/game/alpha-bots";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentGameObjectives } from "@/services/game-objectives";
import {
  getActiveSeasonRaceCalendar,
  getCurrentTeamRaceRosterOptions,
} from "@/services/race-calendar";
import { getSponsoringStateForAuthUser } from "@/services/sponsoring-workflow";
import { getCurrentTeamEquipmentOverview } from "@/services/team-equipment";
import { getCurrentTeamHealthOverview } from "@/services/team-health";
import { getTeamInfrastructureOverview } from "@/services/team-infrastructures";
import { getTeamStaffOverview } from "@/services/team-staff";
import { getCurrentTeamTrainingOverview } from "@/services/team-training";
import { getTransferMarketOverview } from "@/services/transfer-market";
import { getYouthDevelopmentOverview } from "@/services/youth-development";

type AlphaBotManagerRow = {
  id: string;
  bot_key: string;
  auth_user_id: string;
  display_name: string;
  strategy: AlphaBotProfile["strategy"];
};

export type AlphaBotActionLog = {
  area: string;
  status: "acted" | "skipped" | "error";
  detail: string;
};

export type AlphaBotCycleResult = {
  botKey: string;
  displayName: string;
  status: "completed" | "failed" | "already_processed";
  actions: AlphaBotActionLog[];
  error?: string;
};

type GameClient = Parameters<typeof getTeamStaffOverview>[0];

export async function runAlphaBotCycles(
  slot: AlphaBotSlot,
  now = new Date(),
): Promise<AlphaBotCycleResult[]> {
  const admin = createSupabaseAdminClient();
  const managersResult = await admin
    .from("alpha_bot_managers")
    .select("id, bot_key, auth_user_id, display_name, strategy")
    .eq("enabled", true)
    .order("bot_key")
    .returns<AlphaBotManagerRow[]>();

  if (managersResult.error) {
    throw new Error(
      `Impossible de charger les managers alpha : ${managersResult.error.message}`,
    );
  }

  return Promise.all(
    (managersResult.data ?? []).map((manager) =>
      runManagerCycle(admin, manager, slot, now),
    ),
  );
}

async function runManagerCycle(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  manager: AlphaBotManagerRow,
  slot: AlphaBotSlot,
  now: Date,
): Promise<AlphaBotCycleResult> {
  const profile = ALPHA_BOT_PROFILES.find(
    (candidate) => candidate.key === manager.bot_key,
  );
  if (!profile) {
    return {
      botKey: manager.bot_key,
      displayName: manager.display_name,
      status: "failed",
      actions: [],
      error: "Profil de dÃ©cision introuvable.",
    };
  }

  const cycleKey = buildAlphaBotCycleKey(now, slot);
  const claimResult = await admin.rpc("claim_alpha_bot_cycle", {
    p_manager_id: manager.id,
    p_cycle_key: cycleKey,
    p_slot: slot,
  });
  if (claimResult.error) {
    return {
      botKey: manager.bot_key,
      displayName: manager.display_name,
      status: "failed",
      actions: [],
      error: claimResult.error.message,
    };
  }

  const cycleId =
    typeof claimResult.data === "string" ? claimResult.data : null;
  if (!cycleId) {
    return {
      botKey: manager.bot_key,
      displayName: manager.display_name,
      status: "already_processed",
      actions: [],
    };
  }

  const actions: AlphaBotActionLog[] = [];
  try {
    const client = await authenticateBot(manager.auth_user_id);
    const gameClient = client as unknown as GameClient;
    const context: ActionContext = {
      client,
      gameClient,
      profile,
      authUserId: manager.auth_user_id,
      cycleKey,
      slot,
      now,
    };

    await recordAction(actions, "staff", () => manageStaff(context));
    await recordAction(actions, "training", () => manageTraining(context));
    await recordAction(actions, "equipment", () => manageEquipment(context));
    await recordAction(actions, "races", () => manageRaceRegistration(context));
    await recordAction(actions, "health", () => manageHealth(context));
    await recordAction(actions, "youth", () => manageYouth(context));
    await recordAction(actions, "transfers", () => manageTransfers(context));
    await recordAction(actions, "sponsoring", () => manageSponsoring(context));
    await recordAction(actions, "infrastructure", () =>
      manageInfrastructure(context),
    );
    await recordAction(actions, "objectives", () => manageObjectives(context));

    await finishCycle(admin, cycleId, "completed", actions);
    return {
      botKey: manager.bot_key,
      displayName: manager.display_name,
      status: "completed",
      actions,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    await finishCycle(admin, cycleId, "failed", actions, message);
    return {
      botKey: manager.bot_key,
      displayName: manager.display_name,
      status: "failed",
      actions,
      error: message,
    };
  }
}

type ActionContext = {
  client: SupabaseClient;
  gameClient: GameClient;
  profile: AlphaBotProfile;
  authUserId: string;
  cycleKey: string;
  slot: AlphaBotSlot;
  now: Date;
};

async function manageStaff(context: ActionContext) {
  const overview = await getTeamStaffOverview(
    context.gameClient,
    context.authUserId,
  );
  if (!overview || overview.availableStaffSlots <= 0) {
    return null;
  }

  const candidate = overview.marketListings
    .filter((listing) => listing.canHire)
    .sort(
      (left, right) =>
        right.member.level - left.member.level ||
        left.member.salaryPerSeason - right.member.salaryPerSeason,
    )[0];
  if (!candidate) return null;

  const result = await context.client.rpc("hire_current_team_staff", {
    p_listing_id: candidate.id,
  });
  assertRpc(result.error);
  return `Recrutement de ${candidate.member.firstName} ${candidate.member.lastName} (${candidate.member.role}, niveau ${candidate.member.level}).`;
}

async function manageTraining(context: ActionContext) {
  const overview = await getCurrentTeamTrainingOverview(context.authUserId);
  if (!overview || overview.riders.length === 0) return null;

  if (
    overview.minimumForm !== context.profile.minimumForm &&
    !overview.minimumFormIsPending
  ) {
    const threshold = await context.client.rpc(
      "save_current_team_training_settings",
      { p_minimum_form: context.profile.minimumForm },
    );
    assertRpc(threshold.error);
    return `Seuil minimal de forme rÃ©glÃ© Ã  ${context.profile.minimumForm} %.`;
  }

  const riderIndex = deterministicIndex(
    `${context.cycleKey}:${context.profile.key}:training`,
    overview.riders.length,
  );
  const rider = overview.riders[riderIndex];
  const plan = chooseTrainingPlan(context.profile, rider);
  const trainer =
    overview.trainers
      .filter(
        (candidate) =>
          candidate.assignedRiderCount < candidate.riderCapacity,
      )
      .sort((left, right) => right.level - left.level)[0] ?? null;

  if (
    rider.plan.intensity === plan.intensity &&
    rider.plan.domain === plan.domain &&
    rider.plan.trainerContractId === trainer?.contractId
  ) {
    return null;
  }

  const result = await context.client.rpc(
    "save_current_rider_training_plan",
    {
      p_rider_id: rider.id,
      p_intensity: plan.intensity,
      p_domain: plan.domain,
      p_trainer_contract_id: trainer?.contractId ?? null,
    },
  );
  assertRpc(result.error);
  return `Programme ${plan.domain} Ã  ${plan.intensity} % pour ${rider.firstName} ${rider.lastName}.`;
}

async function manageEquipment(context: ActionContext) {
  const [equipment, training] = await Promise.all([
    getCurrentTeamEquipmentOverview(context.authUserId),
    getCurrentTeamTrainingOverview(context.authUserId),
  ]);
  if (!equipment || !training || training.riders.length === 0) return null;

  const target =
    [...equipment.catalog]
      .filter((item) => item.availableQuantity > 0)
      .sort((left, right) => effectValue(right) - effectValue(left))[0] ??
    [...equipment.catalog]
      .filter(
        (item) =>
          item.price > 0 &&
          item.price <= Math.max(0, equipment.balance - 75_000),
      )
      .sort(
        (left, right) =>
          effectValue(right) / Math.max(1, right.price) -
          effectValue(left) / Math.max(1, left.price),
      )[0];
  if (!target) return null;

  if (target.availableQuantity <= 0) {
    const purchase = await context.client.rpc(
      "purchase_current_team_equipment",
      { p_equipment_item_id: target.id },
    );
    assertRpc(purchase.error);
  }

  const riderIndex = deterministicIndex(
    `${context.cycleKey}:${context.profile.key}:${target.slot}`,
    training.riders.length,
  );
  const rider = training.riders[riderIndex];
  const alreadyAssigned = equipment.assignments.some(
    (assignment) =>
      assignment.riderId === rider.id &&
      assignment.slot === target.slot &&
      assignment.equipmentItemId === target.id,
  );
  if (alreadyAssigned) return null;

  const equip = await context.client.rpc("equip_current_team_rider", {
    p_rider_id: rider.id,
    p_slot_type: target.slot,
    p_equipment_item_id: target.id,
  });
  assertRpc(equip.error);
  return `${target.name} Ã©quipÃ© sur ${rider.firstName} ${rider.lastName}${target.availableQuantity <= 0 ? " aprÃ¨s achat" : ""}.`;
}

async function manageRaceRegistration(context: ActionContext) {
  const calendar = await getActiveSeasonRaceCalendar(
    context.gameClient,
    context.now,
  );
  if (!calendar) return null;

  const edition = calendar.editions
    .filter(
      (candidate) =>
        candidate.status === "registration_open" &&
        candidate.registrationPolicy !== "closed" &&
        !candidate.currentTeamRegistration,
    )
    .sort(
      (left, right) =>
        (left.stages[0]?.dayNumber ?? 999) -
        (right.stages[0]?.dayNumber ?? 999),
    )[0];
  if (!edition) return null;

  const options = await getCurrentTeamRaceRosterOptions(
    context.gameClient,
    edition.id,
  );
  const roster = buildRaceRoster(context.profile, edition, options);
  if (roster.length < edition.minimumRosterSize) return null;

  const result = await context.client.rpc(
    "save_current_team_competition_roster_with_roles",
    {
      p_race_edition_id: edition.id,
      p_roster: roster,
    },
  );
  assertRpc(result.error);
  return `${roster.length} coureurs inscrits sur ${edition.name}.`;
}

async function manageHealth(context: ActionContext) {
  const overview = await getCurrentTeamHealthOverview(context.authUserId);
  if (!overview) return null;

  const untreated = overview.riders.find(
    (rider) => rider.injury && !rider.injury.protocolCode,
  );
  if (untreated?.injury) {
    const result = await context.client.rpc(
      "apply_current_team_injury_protocol",
      {
        p_injury_id: untreated.injury.id,
        p_protocol_code: "complete_care",
      },
    );
    assertRpc(result.error);
    return `Protocole complet appliquÃ© Ã  ${untreated.firstName} ${untreated.lastName}.`;
  }

  const physiotherapist = overview.medicalStaff
    .filter((member) => member.role === "physiotherapist")
    .sort((left, right) => right.level - left.level)[0];
  if (physiotherapist) {
    const protectedRiders = [...overview.riders]
      .sort(
        (left, right) =>
          right.fatigue - left.fatigue || left.form - right.form,
      )
      .slice(0, Math.min(5, overview.riders.length))
      .map((rider) => rider.id);
    const current = [...physiotherapist.assignedRiderIds].sort().join(",");
    const desired = [...protectedRiders].sort().join(",");
    if (current !== desired) {
      const result = await context.client.rpc(
        "assign_current_team_physiotherapist",
        {
          p_staff_contract_id: physiotherapist.contractId,
          p_rider_ids: protectedRiders,
        },
      );
      assertRpc(result.error);
      return `${protectedRiders.length} coureurs confiÃ©s au physiothÃ©rapeute.`;
    }
  }

  const nutritionist = overview.medicalStaff
    .filter((member) => member.role === "nutritionist")
    .sort((left, right) => right.level - left.level)[0];
  const lowFormRider = overview.riders
    .filter(
      (rider) =>
        !rider.injury &&
        !rider.formCamp &&
        !overview.nutritionInterventionsToday.some(
          (intervention) => intervention.riderId === rider.id,
        ),
    )
    .sort((left, right) => left.form - right.form)[0];
  if (nutritionist && lowFormRider && lowFormRider.form < 45) {
    const code =
      nutritionist.level >= 5
        ? "elite_recharge"
        : nutritionist.level >= 3
          ? "tailored_plan"
          : "recovery_snack";
    const result = await context.client.rpc(
      "apply_current_team_nutrition_intervention",
      {
        p_rider_id: lowFormRider.id,
        p_nutritionist_contract_id: nutritionist.contractId,
        p_intervention_code: code,
      },
    );
    assertRpc(result.error);
    return `Intervention nutritionnelle pour ${lowFormRider.firstName} ${lowFormRider.lastName}.`;
  }
  return null;
}

async function manageYouth(context: ActionContext) {
  const overview = await getYouthDevelopmentOverview(
    context.gameClient,
    context.authUserId,
  );
  if (!overview) return null;

  const unreadMission = overview.missions.find(
    (mission) => mission.status === "completed" && mission.unread,
  );
  if (unreadMission) {
    const result = await context.client.rpc(
      "mark_current_team_scouting_report_viewed",
      { p_mission_id: unreadMission.id },
    );
    assertRpc(result.error);
    return `Rapport de scouting consultÃ© en ${unreadMission.countryName}.`;
  }

  const candidate = overview.missions
    .filter((mission) => mission.status === "completed" && !mission.unread)
    .flatMap((mission) => mission.candidates)
    .filter((item) => item.status === "spotted")
    .sort(
      (left, right) =>
        right.potentialSteps - left.potentialSteps ||
        left.signingFee - right.signingFee,
    )[0];
  if (
    candidate &&
    candidate.signingFee <= Math.max(0, overview.balance - 100_000)
  ) {
    const result = await context.client.rpc(
      "sign_current_team_youth_candidate",
      { p_candidate_id: candidate.id },
    );
    assertRpc(result.error);
    return `${candidate.firstName} ${candidate.lastName} rejoint lâ€™Ã©cole de cyclisme.`;
  }

  const idleScout = overview.scouts.find((scout) => !scout.activeMissionId);
  if (idleScout && overview.countries.length > 0) {
    const countryIndex = deterministicIndex(
      `${context.cycleKey}:${context.profile.key}:youth`,
      overview.countries.length,
    );
    const country = overview.countries[countryIndex];
    const result = await context.client.rpc(
      "start_current_team_youth_scouting",
      {
        p_scout_contract_id: idleScout.contractId,
        p_country_id: country.id,
        p_duration_days: 3,
      },
    );
    assertRpc(result.error);
    return `Mission de scouting lancÃ©e en ${country.name}.`;
  }

  const academyRider = overview.academy[0];
  if (academyRider && academyRider.trainingModePreference !== "automatic") {
    const result = await context.client.rpc(
      "save_current_youth_training_settings",
      {
        p_academy_rider_id: academyRider.id,
        p_training_priority: academyRider.trainingPriority,
        p_training_mode: "automatic",
      },
    );
    assertRpc(result.error);
    return `EntraÃ®nement automatique programmÃ© pour ${academyRider.firstName} ${academyRider.lastName}.`;
  }
  return null;
}

async function manageTransfers(context: ActionContext) {
  const overview = await getTransferMarketOverview(
    context.gameClient,
    context.authUserId,
  );
  if (
    !overview ||
    overview.rosterIsFull ||
    overview.availableBudget < 20_000
  ) {
    return null;
  }

  const maximumBid = Math.min(
    overview.availableBudget * 0.15,
    250_000,
  );
  const listing = overview.dailyListings
    .filter(
      (candidate) =>
        !candidate.isOwnTeamLeading &&
        candidate.minimumNextBid <= maximumBid,
    )
    .sort(
      (left, right) =>
        getScoutedNumericSortValue(right.rider.scoutingReport.overall) -
        getScoutedNumericSortValue(left.rider.scoutingReport.overall),
    )[0];
  if (!listing) return null;

  const result = await context.client.rpc("place_transfer_bid", {
    p_listing_id: listing.id,
    p_amount: listing.minimumNextBid,
  });
  assertRpc(result.error);
  return `Offre de ${listing.minimumNextBid.toLocaleString("fr-FR")} ${listing.currency} sur ${listing.rider.firstName} ${listing.rider.lastName}.`;
}

async function manageSponsoring(context: ActionContext) {
  const state = await getSponsoringStateForAuthUser(context.authUserId);
  const future =
    state.kind === "active" ||
    state.kind === "terminated" ||
    state.kind === "amateur-qualified"
      ? state.future
      : null;
  const offers =
    state.kind === "offers"
      ? state.offers
      : future?.kind === "offers"
        ? future.offers
        : [];
  if (offers.length > 0) {
    const offer = [...offers].sort(
      (left, right) => right.proposedBudget - left.proposedBudget,
    )[0];
    const result = await context.client.rpc("sign_sponsor_offer", {
      p_offer_id: offer.id,
    });
    assertRpc(result.error);
    return `Offre ${offer.sponsor.name} acceptÃ©e pour la prochaine saison.`;
  }

  const jerseySelection =
    state.kind === "jersey-selection"
      ? state.contract
      : future?.kind === "jersey-selection"
        ? future.contract
        : null;
  const jersey = jerseySelection?.sponsor.jerseys[0];
  if (jerseySelection && jersey) {
    const result = await context.client.rpc("validate_sponsor_jersey", {
      p_contract_id: jerseySelection.id,
      p_jersey_id: jersey.id,
      p_jersey_style: jersey.style,
    });
    assertRpc(result.error);
    return `Maillot ${jersey.name} validÃ© pour ${jerseySelection.sponsor.name}.`;
  }
  return null;
}

async function manageInfrastructure(context: ActionContext) {
  const overview = await getTeamInfrastructureOverview(
    context.gameClient,
    context.authUserId,
  );
  if (
    !overview ||
    !overview.isUnlocked ||
    overview.activeProject ||
    !overview.dataRoomNextLevel ||
    overview.balance < overview.dataRoomNextLevel.cost + 150_000
  ) {
    return null;
  }
  const architect =
    [...overview.architects].sort(
      (left, right) => right.level - left.level,
    )[0] ?? null;
  const result = await context.client.rpc(
    "start_current_team_infrastructure_project",
    {
      p_infrastructure_code: "recruitment_data_room",
      p_country_id: null,
      p_architect_contract_id: architect?.contractId ?? null,
    },
  );
  assertRpc(result.error);
  return `Chantier Data Room niveau ${overview.dataRoomNextLevel.level} lancÃ©.`;
}

async function manageObjectives(context: ActionContext) {
  const objectives = await getCurrentGameObjectives(context.gameClient);
  const claimable = objectives.find(
    (objective) => objective.completed && !objective.claimedAt,
  );
  if (!claimable) return null;

  const result = await context.client.rpc("claim_current_game_objective", {
    p_objective_key: claimable.key,
  });
  assertRpc(result.error);
  return `RÃ©compense de lâ€™objectif Â« ${claimable.title} Â» rÃ©cupÃ©rÃ©e.`;
}

async function authenticateBot(authUserId: string) {
  const url = readEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = readEnvironment(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  const admin = createSupabaseAdminClient();
  const userResult = await admin.auth.admin.getUserById(authUserId);
  const email = userResult.data.user?.email;
  if (userResult.error || !email) {
    throw new Error(
      `Compte de test introuvable : ${userResult.error?.message ?? authUserId}`,
    );
  }

  const linkResult = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = linkResult.data.properties?.hashed_token;
  if (linkResult.error || !tokenHash) {
    throw new Error(
      `Impossible dâ€™ouvrir une session de test : ${linkResult.error?.message ?? "jeton absent"}`,
    );
  }

  const client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const verification = await client.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (verification.error || !verification.data.user) {
    throw new Error(
      `Authentification du compte de test impossible : ${verification.error?.message ?? "session absente"}`,
    );
  }
  return client;
}

async function recordAction(
  actions: AlphaBotActionLog[],
  area: string,
  operation: () => Promise<string | null>,
) {
  try {
    const detail = await operation();
    actions.push({
      area,
      status: detail ? "acted" : "skipped",
      detail: detail ?? "Aucune action pertinente sur ce cycle.",
    });
  } catch (error) {
    actions.push({
      area,
      status: "error",
      detail: getErrorMessage(error).slice(0, 500),
    });
  }
}

async function finishCycle(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  cycleId: string,
  status: "completed" | "failed",
  actions: AlphaBotActionLog[],
  error?: string,
) {
  const result = await admin.rpc("complete_alpha_bot_cycle", {
    p_cycle_id: cycleId,
    p_status: status,
    p_actions: actions,
    p_error_message: error ?? null,
  });
  if (result.error) {
    throw new Error(
      `Impossible de journaliser le cycle : ${result.error.message}`,
    );
  }
}

function effectValue(item: {
  effects: {
    ratingBonuses: Record<string, number | undefined>;
    timeTrialRatingBonuses: Record<string, number | undefined>;
    injuryRiskReductionPct: number;
    breakawayReputationBonus: number;
    victoryReputationBonus: number;
  };
}) {
  return (
    Object.values(item.effects.ratingBonuses).reduce<number>(
      (total, value) => total + (value ?? 0),
      0,
    ) +
    Object.values(item.effects.timeTrialRatingBonuses).reduce<number>(
      (total, value) => total + (value ?? 0),
      0,
    ) +
    item.effects.injuryRiskReductionPct / 5 +
    item.effects.breakawayReputationBonus / 5 +
    item.effects.victoryReputationBonus / 5
  );
}

function assertRpc(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function readEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable ${name} absente.`);
  return value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
