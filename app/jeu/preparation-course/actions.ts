"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { RACE_ROLES, type RaceRole } from "@/lib/game/race-simulation";
import {
  RACE_EQUIPMENT_EMPTY,
  RACE_EQUIPMENT_INHERIT,
  parseRaceEquipmentPlanEntry,
} from "@/lib/game/race-equipment-planning";
import {
  MAX_RACE_ATTACK_ORDERS,
  RACE_ATTACK_CONDITIONS,
  RACE_ATTACK_INTENSITIES,
  RACE_BREAKAWAY_POLICIES,
  RACE_CHASE_POLICIES,
  RACE_COLLECTIVE_POSTURES,
  RACE_STRATEGY_OBJECTIVES,
  isRaceStrategyValue,
  type RaceAttackOrder,
} from "@/lib/game/race-strategy";
import {
  isTimeTrialEffortMode,
  type TimeTrialEffortMode,
} from "@/lib/game/time-trial-preparation";
import type { RaceStageType } from "@/lib/game/race-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveRacePreparationAction(formData: FormData) {
  const editionId = readFormValue(formData, "editionId");
  const stageId = readFormValue(formData, "stageId");
  const stageNumber = readFormValue(formData, "stageNumber");
  const slug = readFormValue(formData, "slug");
  const roles = readSubmittedRoles(formData).map(([riderId, role]) => ({
    riderId,
    role,
  }));
  const objective = readFormValue(formData, "objective");
  const collectivePosture = readFormValue(formData, "collectivePosture");
  const breakawayPolicy = readFormValue(formData, "breakawayPolicy");
  const chasePolicy = readFormValue(formData, "chasePolicy");
  const lieutenantRiderId = readOptionalRiderId(formData, "lieutenantRiderId");
  const dangerPacerRiderId = readOptionalRiderId(
    formData,
    "dangerPacerRiderId",
  );
  const protectorRiderId = readOptionalRiderId(formData, "protectorRiderId");
  const breakawayRiderId = readOptionalRiderId(formData, "breakawayRiderId");
  const attackOrders = readAttackOrders(formData);

  if (
    !isUuid(editionId) ||
    !isUuid(stageId) ||
    !isSlug(slug) ||
    !/^\d+$/.test(stageNumber) ||
    roles.length === 0 ||
    !isRaceStrategyValue(RACE_STRATEGY_OBJECTIVES, objective) ||
    !isRaceStrategyValue(RACE_COLLECTIVE_POSTURES, collectivePosture) ||
    !isRaceStrategyValue(RACE_BREAKAWAY_POLICIES, breakawayPolicy) ||
    !isRaceStrategyValue(RACE_CHASE_POLICIES, chasePolicy) ||
    [
      lieutenantRiderId,
      dangerPacerRiderId,
      protectorRiderId,
      breakawayRiderId,
    ].some((riderId) => riderId !== null && !isUuid(riderId)) ||
    attackOrders === null
  ) {
    redirectWithError(
      "/jeu/preparation-course",
      "Le plan de course transmis est incomplet ou invalide.",
    );
  }

  const dutyRiderIds = [
    lieutenantRiderId,
    dangerPacerRiderId,
    protectorRiderId,
    breakawayRiderId,
  ].filter((riderId): riderId is string => Boolean(riderId));
  if (new Set(dutyRiderIds).size !== dutyRiderIds.length) {
    redirectWithError(
      `/jeu/preparation-course?course=${encodeURIComponent(slug)}`,
      "Un même coureur ne peut pas cumuler deux missions spéciales.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("save_current_team_race_preparation", {
    p_race_edition_id: editionId,
    p_stage_id: stageId,
    p_roles: roles,
    p_strategy: {
      objective,
      collectivePosture,
      breakawayPolicy,
      chasePolicy,
      lieutenantRiderId,
      dangerPacerRiderId,
      protectorRiderId,
      breakawayRiderId,
      attackOrders,
    },
  });

  if (error) {
    redirectWithError(
      `/jeu/preparation-course?course=${encodeURIComponent(slug)}`,
      error.message,
    );
  }

  revalidatePath("/jeu/preparation-course");
  revalidatePath(`/jeu/courses/${slug}`);
  revalidatePath("/jeu/resultats");
  revalidatePath("/jeu");
  redirect(
    `/jeu/preparation-course?course=${encodeURIComponent(slug)}&etape=${stageNumber}&enregistrement=confirme#etape-${stageId}`,
  );
}

export async function saveTimeTrialPreparationAction(formData: FormData) {
  const editionId = readFormValue(formData, "editionId");
  const stageId = readFormValue(formData, "stageId");
  const stageNumber = readFormValue(formData, "stageNumber");
  const stageType = readFormValue(formData, "stageType") as RaceStageType;
  const slug = readFormValue(formData, "slug");
  const plans = readTimeTrialPlans(formData);
  const isTeamTimeTrial = stageType === "team_time_trial";

  if (
    !isUuid(editionId) ||
    !isUuid(stageId) ||
    !isSlug(slug) ||
    !/^\d+$/.test(stageNumber) ||
    !["individual_time_trial", "team_time_trial", "prologue"].includes(
      stageType,
    ) ||
    !plans ||
    plans.length === 0 ||
    (isTeamTimeTrial &&
      Math.abs(
        plans.reduce(
          (total, plan) => total + (plan.relaySharePct ?? 0),
          0,
        ) - 100,
      ) > 0.001)
  ) {
    redirectWithError(
      `/jeu/preparation-course${slug ? `?course=${encodeURIComponent(slug)}` : ""}`,
      isTeamTimeTrial
        ? "La répartition des relais doit couvrir toute l’équipe et totaliser exactement 100 %."
        : "Le plan du contre-la-montre transmis est incomplet ou invalide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc(
    "save_current_team_time_trial_preparation",
    {
      p_race_edition_id: editionId,
      p_stage_id: stageId,
      p_plan: plans,
    },
  );

  if (error) {
    redirectWithError(
      `/jeu/preparation-course?course=${encodeURIComponent(slug)}`,
      error.message,
    );
  }

  revalidatePath("/jeu/preparation-course");
  revalidatePath(`/jeu/courses/${slug}`);
  revalidatePath("/jeu/resultats");
  revalidatePath("/jeu");
  redirect(
    `/jeu/preparation-course?course=${encodeURIComponent(slug)}&etape=${stageNumber}&enregistrement=confirme#etape-${stageId}`,
  );
}

export async function saveRaceEquipmentPlanAction(formData: FormData) {
  const editionId = readFormValue(formData, "editionId");
  const stageId = readFormValue(formData, "stageId");
  const slug = readFormValue(formData, "slug");
  const applyToTour = readFormValue(formData, "applyToTour") === "true";
  const entries = formData.getAll("loadouts").map(parseRaceEquipmentPlanEntry);

  if (
    !isUuid(editionId) ||
    !isUuid(stageId) ||
    !isSlug(slug) ||
    entries.length === 0 ||
    entries.some((entry) => entry === null)
  ) {
    redirectWithError(
      "/jeu/preparation-course",
      "Le montage de course envoyé est invalide.",
    );
  }

  const loadouts = entries.map((entry) => {
    if (!entry) throw new Error("Entrée de matériel invalide.");
    if (entry.selection === RACE_EQUIPMENT_INHERIT) {
      return { riderId: entry.riderId, slot: entry.slot, mode: "inherit" };
    }
    if (entry.selection === RACE_EQUIPMENT_EMPTY) {
      return { riderId: entry.riderId, slot: entry.slot, mode: "empty" };
    }
    return {
      riderId: entry.riderId,
      slot: entry.slot,
      mode: "item",
      equipmentItemId: entry.selection,
    };
  });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc(
    "save_current_team_race_equipment_plan",
    {
      p_race_edition_id: editionId,
      p_stage_id: stageId,
      p_loadouts: loadouts,
      p_apply_to_tour: applyToTour,
    },
  );

  if (error) {
    redirectWithError(
      `/jeu/preparation-course?course=${encodeURIComponent(slug)}&materiel=erreur&stage=${stageId}`,
      error.message,
    );
  }

  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/preparation-course");
  revalidatePath(`/jeu/courses/${slug}`);
  revalidatePath("/jeu/resultats");
  revalidatePath(`/jeu/resultats/${slug}`);
  revalidatePath("/jeu");
  redirect(
    `/jeu/preparation-course?course=${encodeURIComponent(slug)}&materiel=${applyToTour ? "tour" : "enregistre"}&stage=${stageId}#materiel-${editionId}`,
  );
}

function readSubmittedRoles(formData: FormData) {
  const roles = new Map<string, RaceRole>();

  for (const value of formData.getAll("stageRoles")) {
    if (typeof value !== "string") continue;
    const separatorIndex = value.indexOf(":");
    if (separatorIndex === -1) continue;
    const riderId = value.slice(0, separatorIndex);
    const role = value.slice(separatorIndex + 1);

    if (isUuid(riderId) && RACE_ROLES.includes(role as RaceRole)) {
      roles.set(riderId, role as RaceRole);
    }
  }

  return [...roles];
}

function readAttackOrders(formData: FormData): RaceAttackOrder[] | null {
  const serialized = readFormValue(formData, "attackOrders");
  let entries: unknown;

  try {
    entries = JSON.parse(serialized || "[]");
  } catch {
    return null;
  }

  if (!Array.isArray(entries) || entries.length > MAX_RACE_ATTACK_ORDERS) {
    return null;
  }

  const orders: RaceAttackOrder[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Record<string, unknown>;
    const riderId =
      typeof candidate.riderId === "string" ? candidate.riderId : "";
    const segmentNumber = Number(candidate.segmentNumber);
    const intensity =
      typeof candidate.intensity === "string" ? candidate.intensity : "";
    const condition =
      typeof candidate.condition === "string" ? candidate.condition : "";

    if (
      !isUuid(riderId) ||
      !Number.isInteger(segmentNumber) ||
      segmentNumber < 1 ||
      !isRaceStrategyValue(RACE_ATTACK_INTENSITIES, intensity) ||
      !isRaceStrategyValue(RACE_ATTACK_CONDITIONS, condition)
    ) {
      return null;
    }
    orders.push({ riderId, segmentNumber, intensity, condition });
  }

  return orders;
}

function readTimeTrialPlans(formData: FormData): Array<{
  riderId: string;
  effortMode: TimeTrialEffortMode;
  relaySharePct: number | null;
}> | null {
  const serialized = readFormValue(formData, "timeTrialPlans");
  let entries: unknown;

  try {
    entries = JSON.parse(serialized || "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const plans: Array<{
    riderId: string;
    effortMode: TimeTrialEffortMode;
    relaySharePct: number | null;
  }> = [];
  const riderIds = new Set<string>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Record<string, unknown>;
    const riderId =
      typeof candidate.riderId === "string" ? candidate.riderId : "";
    const effortMode = candidate.effortMode;
    const relaySharePct =
      candidate.relaySharePct === null
        ? null
        : Number(candidate.relaySharePct);

    if (
      !isUuid(riderId) ||
      riderIds.has(riderId) ||
      !isTimeTrialEffortMode(effortMode) ||
      (relaySharePct !== null &&
        (!Number.isFinite(relaySharePct) ||
          relaySharePct < 0 ||
          relaySharePct > 100))
    ) {
      return null;
    }

    riderIds.add(riderId);
    plans.push({ riderId, effortMode, relaySharePct });
  }

  return plans;
}

function readOptionalRiderId(formData: FormData, key: string) {
  const value = readFormValue(formData, key);
  return value === "" ? null : isUuid(value) ? value : "invalid";
}

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}erreur=${encodeURIComponent(message.slice(0, 300))}`,
  );
}
