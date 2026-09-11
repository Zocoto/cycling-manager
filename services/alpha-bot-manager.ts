import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  ALPHA_BOT_AUTOMATION_END_DAY,
  ALPHA_BOT_PROFILES,
  ALPHA_BOT_TARGET_ROSTER_SIZE,
  buildAlphaBotCycleKey,
  buildRaceRoster,
  chooseTrainingPlan,
  deterministicIndex,
  getBotRaceRegistrationCandidates,
  isSharedMarketItemAssignedToBot,
  type AlphaBotProfile,
  type AlphaBotSlot,
} from "@/lib/game/alpha-bots";
import { getPhysiotherapistRiderCapacity } from "@/lib/game/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentDailyRewardOverview } from "@/services/daily-rewards";
import { getCurrentGameObjectives } from "@/services/game-objectives";
import {
  getActiveSeasonRaceCalendar,
  getCurrentTeamRaceRosterOptions,
} from "@/services/race-calendar";
import { getCurrentTeamEquipmentOverview } from "@/services/team-equipment";
import { getCurrentTeamHealthOverview } from "@/services/team-health";
import { getTeamStaffOverview } from "@/services/team-staff";
import { getCurrentTeamTrainingOverview } from "@/services/team-training";
import { getTransferMarketOverview } from "@/services/transfer-market";

type AlphaBotManagerRow = {
  id: string;
  bot_key: string;
  auth_user_id: string;
  display_name: string;
  strategy: AlphaBotProfile["strategy"];
  automation_season_id: string | null;
  automation_end_day_number: number | null;
};

type ActiveSeasonRow = {
  id: string;
  name: string;
  current_day_number: number | null;
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

type ActionContext = {
  client: SupabaseClient;
  gameClient: GameClient;
  profile: AlphaBotProfile;
  authUserId: string;
  cycleKey: string;
  slot: AlphaBotSlot;
  now: Date;
  currentDayNumber: number;
};

export async function runAlphaBotCycles(
  slot: AlphaBotSlot,
  now = new Date(),
): Promise<AlphaBotCycleResult[]> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, name, current_day_number")
    .eq("status", "active")
    .maybeSingle<ActiveSeasonRow>();
  assertRpc(seasonResult.error);
  const season = seasonResult.data;
  if (!season) return [];

  const currentDayNumber = season.current_day_number ?? 1;
  if (
    currentDayNumber < 1 ||
    currentDayNumber > ALPHA_BOT_AUTOMATION_END_DAY
  ) {
    return [];
  }

  const managersResult = await admin
    .from("alpha_bot_managers")
    .select(
      "id, bot_key, auth_user_id, display_name, strategy, automation_season_id, automation_end_day_number",
    )
    .eq("enabled", true)
    .eq("automation_season_id", season.id)
    .gte("automation_end_day_number", currentDayNumber)
    .order("bot_key")
    .returns<AlphaBotManagerRow[]>();
  assertRpc(managersResult.error);

  return Promise.all(
    (managersResult.data ?? []).map((manager) =>
      runManagerCycle(admin, manager, slot, currentDayNumber, now),
    ),
  );
}

async function runManagerCycle(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  manager: AlphaBotManagerRow,
  slot: AlphaBotSlot,
  currentDayNumber: number,
  now: Date,
): Promise<AlphaBotCycleResult> {
  const profile = ALPHA_BOT_PROFILES.find(
    (candidate) => candidate.key === manager.bot_key,
  );
  if (!profile) {
    return failedResult(manager, "Profil de décision introuvable.");
  }

  const cycleKey = buildAlphaBotCycleKey(now, slot);
  const claimResult = await admin.rpc("claim_alpha_bot_cycle", {
    p_manager_id: manager.id,
    p_cycle_key: cycleKey,
    p_slot: slot,
  });
  if (claimResult.error) return failedResult(manager, claimResult.error.message);

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
    const context: ActionContext = {
      client,
      gameClient: client as unknown as GameClient,
      profile,
      authUserId: manager.auth_user_id,
      cycleKey,
      slot,
      now,
      currentDayNumber,
    };

    await recordAction(actions, "daily_reward", () =>
      manageDailyReward(context),
    );
    await recordAction(actions, "objectives", () => manageObjectives(context));
    await recordAction(actions, "staff", () => manageStaff(context));
    await recordAction(actions, "transfers", () => manageTransfers(context));
    await recordAction(actions, "training", () => manageTraining(context));
    await recordAction(actions, "equipment", () => manageEquipment(context));
    await recordAction(actions, "health", () => manageHealth(context));
    await recordAction(actions, "form_camp", () => manageFormCamp(context));
    await recordAction(actions, "races", () =>
      manageRaceRegistration(context),
    );

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

async function manageDailyReward(context: ActionContext) {
  const overview = await getCurrentDailyRewardOverview(context.client);
  if (!overview?.availableToday || overview.claimedToday) return null;

  const priority: Record<string, number> = {
    equipment: 8,
    training_multiplier: 7,
    scouting_boost: 6,
    form_boost: 5,
    rider_experience: 4,
  };
  const offer = [...overview.offers].sort(
    (left, right) =>
      (priority[right.effectKind] ?? 0) -
        (priority[left.effectKind] ?? 0) ||
      left.key.localeCompare(right.key),
  )[0];
  if (!offer) return null;

  const result = await context.client.rpc("claim_current_daily_reward", {
    p_reward_key: offer.key,
  });
  assertRpc(result.error);
  return `Cadeau du jour récupéré : ${offer.name}.`;
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
  return `Récompense de l’objectif « ${claimable.title} » récupérée.`;
}

async function manageStaff(context: ActionContext) {
  const overview = await getTeamStaffOverview(
    context.gameClient,
    context.authUserId,
  );
  if (!overview || overview.availableStaffSlots <= 0) return null;

  const rolePriority: Record<AlphaBotProfile["strategy"], string[]> = {
    climber: ["trainer", "physiotherapist", "doctor", "scout", "mechanic"],
    classics: ["mechanic", "trainer", "physiotherapist", "scout", "doctor"],
    sprinter: ["trainer", "nutritionist", "physiotherapist", "mechanic", "scout"],
    rouleur: ["trainer", "mechanic", "physiotherapist", "architect", "scout"],
    development: ["trainer", "scout", "physiotherapist", "nutritionist", "mechanic"],
  };
  const activeRoles = new Set(overview.teamStaff.map((member) => member.role));
  const missingRoles = rolePriority[context.profile.strategy].filter(
    (role) => !activeRoles.has(role as never),
  );
  const candidates = overview.marketListings
    .filter(
      (listing) =>
        listing.canHire &&
        listing.member.signingFee <= Math.max(0, overview.balance - 10_000) &&
        isSharedMarketItemAssignedToBot({
          botKey: context.profile.key,
          cycleKey: context.cycleKey,
          channel: "staff",
          itemId: listing.id,
        }),
    )
    .sort((left, right) => {
      const leftPriority = missingRoles.indexOf(left.member.role);
      const rightPriority = missingRoles.indexOf(right.member.role);
      const normalizedLeft = leftPriority < 0 ? 999 : leftPriority;
      const normalizedRight = rightPriority < 0 ? 999 : rightPriority;
      return (
        normalizedLeft - normalizedRight ||
        right.member.level - left.member.level ||
        left.member.signingFee - right.member.signingFee
      );
    });
  const candidate = candidates[0];
  if (!candidate) return null;

  const result = await context.client.rpc("hire_current_team_staff", {
    p_listing_id: candidate.id,
  });
  assertRpc(result.error);
  return `Recrutement de ${candidate.member.firstName} ${candidate.member.lastName} (${candidate.member.role}, niveau ${candidate.member.level}).`;
}

async function manageTransfers(context: ActionContext) {
  const overview = await getTransferMarketOverview(
    context.gameClient,
    context.authUserId,
    { contractStatus: "free" },
    { includeRiderSearch: true },
  );
  if (!overview || overview.rosterIsFull || overview.availableBudget < 500) {
    return null;
  }

  if (overview.rosterSize < ALPHA_BOT_TARGET_ROSTER_SIZE) {
    const candidates = overview.riderSearchResults
      .filter(
        (candidate) =>
          candidate.contractStatus === "free" &&
          !candidate.hasChangedTeamThisSeason &&
          candidate.salaryPerSeason <= overview.availableBudget &&
          isSharedMarketItemAssignedToBot({
            botKey: context.profile.key,
            cycleKey: context.cycleKey,
            channel: "free-agent",
            itemId: candidate.id,
          }),
      )
      .sort(
        (left, right) =>
          right.overall - left.overall ||
          left.salaryPerSeason - right.salaryPerSeason,
      );

    for (const candidate of candidates) {
      const result = await context.client.rpc("sign_current_team_free_agent", {
        p_rider_id: candidate.id,
      });
      if (!result.error) {
        return `Signature de ${candidate.firstName} ${candidate.lastName} comme agent libre.`;
      }
    }
  }

  const maximumBid = Math.min(overview.availableBudget * 0.15, 20_000);
  const listing = overview.dailyListings
    .filter(
      (candidate) =>
        !candidate.isOwnTeamLeading &&
        candidate.minimumNextBid <= maximumBid &&
        isSharedMarketItemAssignedToBot({
          botKey: context.profile.key,
          cycleKey: context.cycleKey,
          channel: "transfer-listing",
          itemId: candidate.id,
        }),
    )
    .sort(
      (left, right) =>
        right.rider.overall - left.rider.overall ||
        left.minimumNextBid - right.minimumNextBid,
    )[0];
  if (!listing) return null;

  const result = await context.client.rpc("place_transfer_bid", {
    p_listing_id: listing.id,
    p_amount: listing.minimumNextBid,
  });
  assertRpc(result.error);
  return `Offre de ${listing.minimumNextBid.toLocaleString("fr-FR")} ${listing.currency} sur ${listing.rider.firstName} ${listing.rider.lastName}.`;
}

async function manageTraining(context: ActionContext) {
  const overview = await getCurrentTeamTrainingOverview(context.authUserId);
  if (!overview || overview.riders.length === 0) return null;

  if (
    overview.minimumForm !== context.profile.minimumForm &&
    !overview.minimumFormIsPending
  ) {
    const result = await context.client.rpc(
      "save_current_team_training_settings",
      { p_minimum_form: context.profile.minimumForm },
    );
    assertRpc(result.error);
    return `Seuil minimal de forme réglé à ${context.profile.minimumForm} %.`;
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

  const result = await context.client.rpc("save_current_rider_training_plan", {
    p_rider_id: rider.id,
    p_intensity: plan.intensity,
    p_domain: plan.domain,
    p_trainer_contract_id: trainer?.contractId ?? null,
  });
  assertRpc(result.error);
  return `Programme ${plan.domain} à ${plan.intensity} % pour ${rider.firstName} ${rider.lastName}.`;
}

async function manageEquipment(context: ActionContext) {
  const overview = await getCurrentTeamEquipmentOverview(
    context.authUserId,
    context.gameClient,
  );
  if (!overview || overview.riders.length === 0) return null;

  const usable = [...overview.catalog]
    .filter((item) => item.isUnlimited || item.availableQuantity > 0)
    .sort((left, right) => effectValue(right) - effectValue(left));
  const purchasable = [...overview.catalog]
    .filter(
      (item) =>
        !item.isUnlimited &&
        item.price > 0 &&
        item.price <= Math.max(0, overview.balance - 10_000),
    )
    .sort(
      (left, right) =>
        effectValue(right) / Math.max(1, right.price) -
        effectValue(left) / Math.max(1, left.price),
    );
  const target = usable[0] ?? purchasable[0];
  if (!target) return null;

  const unassignedRiders = overview.riders.filter(
    (rider) =>
      !overview.assignments.some(
        (assignment) =>
          assignment.riderId === rider.id && assignment.slot === target.slot,
      ) &&
      !overview.pendingAssignments.some(
        (assignment) =>
          assignment.riderId === rider.id && assignment.slot === target.slot,
      ),
  );
  if (unassignedRiders.length === 0) return null;

  let purchased = false;
  if (!target.isUnlimited && target.availableQuantity <= 0) {
    const purchase = await context.client.rpc(
      "purchase_current_team_equipment",
      { p_equipment_item_id: target.id },
    );
    assertRpc(purchase.error);
    purchased = true;
  }

  const rider =
    unassignedRiders[
      deterministicIndex(
        `${context.cycleKey}:${context.profile.key}:${target.slot}`,
        unassignedRiders.length,
      )
    ];
  const equip = await context.client.rpc("equip_current_team_rider", {
    p_rider_id: rider.id,
    p_slot_type: target.slot,
    p_equipment_item_id: target.id,
  });
  assertRpc(equip.error);
  return `${target.name} équipé sur ${rider.firstName} ${rider.lastName}${purchased ? " après achat" : ""}.`;
}

async function manageHealth(context: ActionContext) {
  const overview = await getCurrentTeamHealthOverview(context.authUserId);
  if (!overview) return null;

  const untreated = overview.riders.find(
    (rider) => rider.injury && !rider.injury.protocolCode,
  );
  if (untreated?.injury) {
    const protocol = [...overview.protocols]
      .filter((candidate) => candidate.price <= overview.balance - 10_000)
      .sort(
        (left, right) =>
          right.durationReductionPct - left.durationReductionPct ||
          left.formLossPerDay - right.formLossPerDay,
      )[0];
    if (protocol) {
      const result = await context.client.rpc(
        "apply_current_team_injury_protocol",
        {
          p_injury_id: untreated.injury.id,
          p_protocol_code: protocol.code,
        },
      );
      assertRpc(result.error);
      return `${protocol.name} appliqué à ${untreated.firstName} ${untreated.lastName}.`;
    }
  }

  const physiotherapist = overview.medicalStaff
    .filter((member) => member.role === "physiotherapist")
    .sort((left, right) => right.level - left.level)[0];
  if (!physiotherapist) return null;

  const protectedRiders = [...overview.riders]
    .sort(
      (left, right) =>
        right.fatigue - left.fatigue || left.form - right.form,
    )
    .slice(
      0,
      Math.min(
        getPhysiotherapistRiderCapacity(physiotherapist.level) +
          (physiotherapist.talents.some(
            (talent) => talent.code === "physio_rider_capacity",
          )
            ? physiotherapist.level >= 4
              ? 2
              : 1
            : 0),
        overview.riders.length,
      ),
    )
    .map((rider) => rider.id);
  const current = [...physiotherapist.assignedRiderIds].sort().join(",");
  const desired = [...protectedRiders].sort().join(",");
  if (current === desired) return null;

  const result = await context.client.rpc(
    "assign_current_team_physiotherapist",
    {
      p_staff_contract_id: physiotherapist.contractId,
      p_rider_ids: protectedRiders,
    },
  );
  assertRpc(result.error);
  return `${protectedRiders.length} coureurs confiés au kiné.`;
}

async function manageRaceRegistration(context: ActionContext) {
  const calendar = await getActiveSeasonRaceCalendar(
    context.gameClient,
    context.now,
  );
  if (!calendar) return null;

  const directorResult = await context.client
    .from("sporting_directors")
    .select("reputation_points")
    .eq("auth_user_id", context.authUserId)
    .maybeSingle<{ reputation_points: number | string }>();
  assertRpc(directorResult.error);
  const reputationPoints = Number(directorResult.data?.reputation_points ?? 0);
  const training = await getCurrentTeamTrainingOverview(context.authUserId);
  const riderCountryCodes = new Set(
    training?.riders.map((rider) => rider.countryCode) ?? [],
  );
  const candidates = getBotRaceRegistrationCandidates(
    calendar.editions,
    context.now,
    reputationPoints,
    riderCountryCodes,
  );
  const registrations: Array<{ name: string; riderCount: number }> = [];
  let lastError: Error | null = null;

  for (const edition of candidates) {
    try {
      const options = await getCurrentTeamRaceRosterOptions(
        context.gameClient,
        edition.id,
      );
      const roster = buildRaceRoster(context.profile, edition, options);
      if (roster.length < edition.minimumRosterSize) continue;

      const result = await context.client.rpc(
        "save_current_team_competition_roster_with_roles",
        { p_race_edition_id: edition.id, p_roster: roster },
      );
      assertRpc(result.error);
      registrations.push({ name: edition.name, riderCount: roster.length });
    } catch (error) {
      lastError = new Error(`${edition.name} : ${getErrorMessage(error)}`);
    }
  }

  if (registrations.length > 0) {
    const riderCount = registrations.reduce(
      (total, registration) => total + registration.riderCount,
      0,
    );
    return `${registrations.length} course${registrations.length > 1 ? "s" : ""} inscrite${registrations.length > 1 ? "s" : ""}, ${riderCount} engagements.`;
  }
  if (lastError) throw lastError;
  return null;
}

async function manageFormCamp(context: ActionContext) {
  if (context.currentDayNumber >= 14) {
    return null;
  }
  const overview = await getCurrentTeamHealthOverview(context.authUserId);
  if (
    !overview ||
    overview.balance < 14_000 ||
    overview.riders.some((rider) => rider.formCamp)
  ) {
    return null;
  }

  const candidates = [...overview.riders]
    .filter((rider) => !rider.injury && !rider.formCamp && rider.form < 70)
    .sort((left, right) => left.form - right.form);
  for (
    let startDay = context.currentDayNumber + 1;
    startDay <= 14;
    startDay += 1
  ) {
    for (const rider of candidates) {
      const result = await context.client.rpc("book_current_team_form_camps", {
        p_rider_ids: [rider.id],
        p_camp_type: "classic",
        p_start_day_number: startDay,
        p_end_day_number: startDay,
      });
      if (!result.error) {
        return `Stage classique programmé pour ${rider.firstName} ${rider.lastName} en J${startDay}.`;
      }
    }
  }
  return null;
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
      `Compte automatisé introuvable : ${userResult.error?.message ?? authUserId}`,
    );
  }

  const linkResult = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = linkResult.data.properties?.hashed_token;
  if (linkResult.error || !tokenHash) {
    throw new Error(
      `Impossible d’ouvrir une session automatisée : ${linkResult.error?.message ?? "jeton absent"}`,
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
      `Authentification automatisée impossible : ${verification.error?.message ?? "session absente"}`,
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
  assertRpc(result.error);
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

function failedResult(manager: AlphaBotManagerRow, error: string) {
  return {
    botKey: manager.bot_key,
    displayName: manager.display_name,
    status: "failed" as const,
    actions: [],
    error,
  };
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
