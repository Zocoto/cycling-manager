"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { RaceStageType } from "@/lib/game/race-calendar";
import { RACE_ROLES, type RaceRole } from "@/lib/game/race-simulation";
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
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function chooseFederationEquipmentOfferAction(formData: FormData) {
  const countryCode = readCountryCode(formData);
  const offerKey = readFormValue(formData, "offerKey");
  if (!countryCode || !/^[a-z0-9-]{3,80}$/.test(offerKey)) {
    redirectWithError(countryCode, "L’offre équipementier transmise est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "choose_national_federation_equipment_offer",
    { p_country_code: countryCode, p_offer_key: offerKey },
  );
  if (error) redirectWithError(countryCode, error.message);

  revalidateFederation(countryCode);
  redirect(`${federationHref(countryCode)}&choix=confirme`);
}

export async function saveFederationRacePreparationAction(formData: FormData) {
  const countryCode = readCountryCode(formData);
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
  const dangerPacerRiderId = readOptionalRiderId(formData, "dangerPacerRiderId");
  const protectorRiderId = readOptionalRiderId(formData, "protectorRiderId");
  const breakawayRiderId = readOptionalRiderId(formData, "breakawayRiderId");
  const attackOrders = readAttackOrders(formData);

  if (
    !countryCode ||
    !isUuid(editionId) ||
    !isUuid(stageId) ||
    !/^\d+$/.test(stageNumber) ||
    roles.length === 0 ||
    !isRaceStrategyValue(RACE_STRATEGY_OBJECTIVES, objective) ||
    !isRaceStrategyValue(RACE_COLLECTIVE_POSTURES, collectivePosture) ||
    !isRaceStrategyValue(RACE_BREAKAWAY_POLICIES, breakawayPolicy) ||
    !isRaceStrategyValue(RACE_CHASE_POLICIES, chasePolicy) ||
    [lieutenantRiderId, dangerPacerRiderId, protectorRiderId, breakawayRiderId]
      .some((riderId) => riderId !== null && !isUuid(riderId)) ||
    attackOrders === null
  ) {
    redirectWithPreparationError(countryCode, "Le plan national transmis est incomplet ou invalide.");
  }

  const dutyRiderIds = [
    lieutenantRiderId,
    dangerPacerRiderId,
    protectorRiderId,
    breakawayRiderId,
  ].filter((riderId): riderId is string => Boolean(riderId));
  if (new Set(dutyRiderIds).size !== dutyRiderIds.length) {
    redirectWithPreparationError(countryCode, "Un coureur ne peut pas cumuler deux missions spéciales.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "save_national_federation_race_preparation",
    {
      p_country_code: countryCode,
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
    },
  );
  if (error) redirectWithPreparationError(countryCode, error.message);

  revalidateFederation(countryCode);
  revalidatePath(`/jeu/courses/${slug}`);
  redirect(
    `${federationPreparationHref(countryCode)}&course=${encodeURIComponent(slug)}&etape=${stageNumber}&enregistrement=confirme#etape-${stageId}`,
  );
}

export async function saveFederationTimeTrialPreparationAction(formData: FormData) {
  const countryCode = readCountryCode(formData);
  const editionId = readFormValue(formData, "editionId");
  const stageId = readFormValue(formData, "stageId");
  const stageNumber = readFormValue(formData, "stageNumber");
  const stageType = readFormValue(formData, "stageType") as RaceStageType;
  const slug = readFormValue(formData, "slug");
  const plans = readTimeTrialPlans(formData);
  const isTeamTimeTrial = stageType === "team_time_trial";

  if (
    !countryCode ||
    !isUuid(editionId) ||
    !isUuid(stageId) ||
    !/^\d+$/.test(stageNumber) ||
    !["individual_time_trial", "team_time_trial", "prologue"].includes(stageType) ||
    !plans ||
    plans.length === 0 ||
    (isTeamTimeTrial &&
      Math.abs(plans.reduce((total, plan) => total + (plan.relaySharePct ?? 0), 0) - 100) > 0.001)
  ) {
    redirectWithPreparationError(countryCode, "Le plan national du contre-la-montre est incomplet ou invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "save_national_federation_time_trial_preparation",
    {
      p_country_code: countryCode,
      p_race_edition_id: editionId,
      p_stage_id: stageId,
      p_plan: plans,
    },
  );
  if (error) redirectWithPreparationError(countryCode, error.message);

  revalidateFederation(countryCode);
  revalidatePath(`/jeu/courses/${slug}`);
  redirect(
    `${federationPreparationHref(countryCode)}&course=${encodeURIComponent(slug)}&etape=${stageNumber}&enregistrement=confirme#etape-${stageId}`,
  );
}

export async function disabledFederationTacticalAction(formData: FormData) {
  redirectWithPreparationError(
    readCountryCode(formData),
    "Les doctrines du Centre tactique ont été retirées.",
  );
}

function readSubmittedRoles(formData: FormData) {
  const roles = new Map<string, RaceRole>();
  for (const value of formData.getAll("stageRoles")) {
    if (typeof value !== "string") continue;
    const separatorIndex = value.indexOf(":");
    if (separatorIndex < 0) continue;
    const riderId = value.slice(0, separatorIndex);
    const role = value.slice(separatorIndex + 1);
    if (isUuid(riderId) && RACE_ROLES.includes(role as RaceRole)) {
      roles.set(riderId, role as RaceRole);
    }
  }
  return [...roles];
}

function readAttackOrders(formData: FormData): RaceAttackOrder[] | null {
  let entries: unknown;
  try {
    entries = JSON.parse(readFormValue(formData, "attackOrders") || "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(entries) || entries.length > MAX_RACE_ATTACK_ORDERS) return null;
  const orders: RaceAttackOrder[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Record<string, unknown>;
    const riderId = typeof candidate.riderId === "string" ? candidate.riderId : "";
    const segmentNumber = Number(candidate.segmentNumber);
    const intensity = typeof candidate.intensity === "string" ? candidate.intensity : "";
    const condition = typeof candidate.condition === "string" ? candidate.condition : "";
    if (
      !isUuid(riderId) ||
      !Number.isInteger(segmentNumber) ||
      segmentNumber < 1 ||
      !RACE_ATTACK_INTENSITIES.includes(intensity as RaceAttackOrder["intensity"]) ||
      !RACE_ATTACK_CONDITIONS.includes(condition as RaceAttackOrder["condition"])
    ) return null;
    orders.push({
      riderId,
      segmentNumber,
      intensity: intensity as RaceAttackOrder["intensity"],
      condition: condition as RaceAttackOrder["condition"],
    });
  }
  return orders;
}

function readTimeTrialPlans(formData: FormData) {
  let entries: unknown;
  try {
    entries = JSON.parse(readFormValue(formData, "timeTrialPlans") || "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(entries)) return null;
  const plans: Array<{
    riderId: string;
    effortMode: TimeTrialEffortMode;
    relaySharePct: number | null;
  }> = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Record<string, unknown>;
    const riderId = typeof candidate.riderId === "string" ? candidate.riderId : "";
    const effortMode = typeof candidate.effortMode === "string" ? candidate.effortMode : "";
    const relaySharePct = candidate.relaySharePct === null ? null : Number(candidate.relaySharePct);
    if (
      !isUuid(riderId) ||
      !isTimeTrialEffortMode(effortMode) ||
      (relaySharePct !== null && (!Number.isFinite(relaySharePct) || relaySharePct < 0 || relaySharePct > 100))
    ) return null;
    plans.push({ riderId, effortMode, relaySharePct });
  }
  return plans;
}

function readCountryCode(formData: FormData) {
  const value = readFormValue(formData, "countryCode").toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "";
}

function readOptionalRiderId(formData: FormData, key: string) {
  const value = readFormValue(formData, key);
  return value || null;
}

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function federationHref(countryCode: string) {
  return `/jeu/federations/${countryCode.toLowerCase()}?onglet=equipment`;
}

function federationPreparationHref(countryCode: string) {
  return `${federationHref(countryCode)}&volet=preparation`;
}

function redirectWithError(countryCode: string, message: string): never {
  redirect(`${federationHref(countryCode || "fr")}&erreur=${encodeURIComponent(message)}`);
}

function redirectWithPreparationError(countryCode: string, message: string): never {
  redirect(`${federationPreparationHref(countryCode || "fr")}&erreur=${encodeURIComponent(message)}`);
}

function revalidateFederation(countryCode: string) {
  revalidatePath(`/jeu/federations/${countryCode.toLowerCase()}`);
  revalidatePath("/jeu");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/resultats");
}
