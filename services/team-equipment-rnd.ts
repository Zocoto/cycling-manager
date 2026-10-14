import "server-only";
import type { EquipmentSlot, EquipmentEffects } from "@/lib/game/equipment";
import { normalizeEquipmentEffects } from "@/lib/game/equipment";
import { EQUIPMENT_RND_MAX_BONUS, getEquipmentRndBaseDurationDays, getEquipmentRndBonusTotal, isEquipmentRndSpecialty, isEquipmentRndFocus, type EquipmentRndEngineer, type EquipmentRndFocus } from "@/lib/game/equipment-rnd";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTeamEquipmentOverview, type TeamEquipmentCatalogItem } from "@/services/team-equipment";
const SLOT_UNLOCK_LEVEL: Record<EquipmentSlot, number> = { frame: 1, front_wheel: 2, rear_wheel: 2, helmet: 3, shoes: 4, bib_shorts: 5, gloves: 6, glasses: 7 };
const PROJECT_FIELDS = "id,prototype_name,input_equipment_item_id,prototype_equipment_item_id,engineer_contract_id,lab_level,rating_key,success_rate,outcome,rating_delta,research_cost,starts_game_day_index,completes_game_day_index,status,created_at,completed_at,research_focus,input_effect_payload,output_effect_payload,origin_effect_payload,engineer_snapshot";
type ProjectRow = {
  id: string; prototype_name: string | null; input_equipment_item_id: string; prototype_equipment_item_id: string | null;
  engineer_contract_id: string | null; lab_level: number; rating_key: string | null; success_rate: number;
  outcome: "improvement" | "setback" | null; rating_delta: number | null; research_cost: number | string;
  starts_game_day_index: number; completes_game_day_index: number; status: "active" | "completed" | "cancelled";
  created_at: string; completed_at: string | null; research_focus: string | null;
  input_effect_payload: unknown; output_effect_payload: unknown; origin_effect_payload: unknown; engineer_snapshot: unknown;
};
export type { EquipmentRndEngineer } from "@/lib/game/equipment-rnd";
export type EquipmentRndResearchItem = TeamEquipmentCatalogItem & {
  requiredLabLevel: number; bonusTotal: number; baseDurationDays: number;
  originEffects: EquipmentEffects | null; previousEffects: EquipmentEffects | null;
};
export type EquipmentRndProject = {
  id: string; requestedPrototypeName: string | null; engineerContractId: string | null; itemName: string;
  prototypeName: string | null; engineerName: string | null; engineer: EquipmentRndEngineer | null; staffSnapshotAvailable: boolean;
  labLevel: number; ratingKey: string | null; successRate: number; outcome: ProjectRow["outcome"]; ratingDelta: number | null;
  researchCost: number; startsGameDayIndex: number; completesGameDayIndex: number; status: ProjectRow["status"];
  focus: EquipmentRndFocus | null; imagePath: string | null; slot: EquipmentSlot; beforeEffects: EquipmentEffects | null;
  afterEffects: EquipmentEffects | null; originEffects: EquipmentEffects | null; completedAt: string | null;
};
export type TeamEquipmentRndOverview = {
  teamName: string; currentDayNumber: number; currentGameDayIndex: number; balance: number; currency: string;
  labLevel: number; labEfficiencyBonusPercentage: number; researchableItems: EquipmentRndResearchItem[]; cappedItemCount: number;
  engineers: EquipmentRndEngineer[]; availableEngineers: EquipmentRndEngineer[]; researchCapacity: number;
  activeProjects: EquipmentRndProject[]; recentProjects: EquipmentRndProject[];
};
export function readEquipmentRndEngineer(value: unknown): EquipmentRndEngineer | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.contractId !== "string" || typeof row.name !== "string") return null;
  const specialties = Array.isArray(row.specialties) ? row.specialties.filter((value): value is EquipmentRndEngineer["specialties"][number] => typeof value === "string" && isEquipmentRndSpecialty(value)) : [];
  return { contractId: row.contractId, name: row.name, level: Number(row.level), specialties, specialty: specialties[0] ?? null,
    countryName: typeof row.countryName === "string" ? row.countryName : null, countryCode: typeof row.countryCode === "string" ? row.countryCode : null,
    nationalityMultiplier: Number(row.nationalityMultiplier ?? 1), federalMultiplier: Number(row.federalMultiplier ?? 1),
    setbackProtected: row.setbackProtected === true, exceptionalChancePercentage: Number(row.exceptionalChancePercentage ?? 1) };
}
export async function getCurrentTeamEquipmentRndOverview(authUserId: string, client?: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<TeamEquipmentRndOverview | null> {
  const supabase = client ?? await createSupabaseServerClient();
  let equipment = await getCurrentTeamEquipmentOverview(authUserId, supabase);
  if (!equipment) return null;
  const admin = createSupabaseAdminClient();
  const settlement = await admin.rpc("settle_due_equipment_rnd_projects");
  if (settlement.error) throw new Error(settlement.error.message);
  if (Number(settlement.data) > 0) {
    equipment = await getCurrentTeamEquipmentOverview(authUserId, supabase);
    if (!equipment) return null;
  }
  const [infra, active, history, profiles, season] = await Promise.all([
    admin.from("team_infrastructures").select("level,efficiency_bonus_percentage").eq("team_id", equipment.teamId).eq("infrastructure_code", "research_lab").maybeSingle<{ level: number; efficiency_bonus_percentage: number }>(),
    admin.from("equipment_rnd_projects").select(PROJECT_FIELDS).eq("team_id", equipment.teamId).eq("status", "active").order("created_at", { ascending: false }).limit(100).returns<ProjectRow[]>(),
    admin.from("equipment_rnd_projects").select(PROJECT_FIELDS).eq("team_id", equipment.teamId).eq("status", "completed").order("completed_at", { ascending: false }).limit(24).returns<ProjectRow[]>(),
    supabase.rpc("get_current_equipment_rnd_engineers"),
    admin.from("seasons").select("game_year,current_day_number").eq("status", "active").maybeSingle<{ game_year: number; current_day_number: number }>(),
  ]);
  for (const result of [infra, active, history, profiles, season]) if (result.error) throw new Error(result.error.message);
  if (!season.data) throw new Error("Saison active introuvable.");
  const engineers = (Array.isArray(profiles.data) ? profiles.data : []).flatMap(value => { const engineer = readEquipmentRndEngineer(value); return engineer ? [engineer] : []; });
  const engineerByContract = new Map(engineers.map(engineer => [engineer.contractId, engineer]));
  const rows = [...(active.data ?? []), ...(history.data ?? [])];
  const historicalEngineerNames = new Map<string,string>();
  const legacyIds = [...new Set(rows.flatMap(row => row.engineer_contract_id && !engineerByContract.has(row.engineer_contract_id) && !row.engineer_snapshot ? [row.engineer_contract_id] : []))];
  if (legacyIds.length) {
    const contracts = await admin.from("staff_contracts").select("id,staff_member_id").eq("team_id",equipment.teamId).in("id",legacyIds);
    if (contracts.error) throw new Error(contracts.error.message);
    if (contracts.data?.length) {
      const members = await admin.from("staff_members").select("id,first_name,last_name").in("id",contracts.data.map(row=>row.staff_member_id));
      if (members.error) throw new Error(members.error.message);
      const names = new Map((members.data ?? []).map(member=>[member.id,`${member.first_name} ${member.last_name}`]));
      for (const contract of contracts.data) { const name=names.get(contract.staff_member_id); if (name) historicalEngineerNames.set(contract.id,name); }
    }
  }
  const itemById = new Map(equipment.catalog.map(item => [item.id, item]));
  // Fetch historical/just-settled references missing from the initial catalogue.
  // Never infer their before stats from the project's final delta.
  const missingIds = [...new Set(rows.flatMap(row => [row.input_equipment_item_id, row.prototype_equipment_item_id].filter((id): id is string => !!id && !itemById.has(id))))];
  const historicalItems = new Map<string, { name: string; image_path: string | null; slot_type: EquipmentSlot; effect_payload: unknown }>();
  if (missingIds.length) {
    const result = await admin.from("equipment_catalog_items").select("id,name,image_path,slot_type,effect_payload").in("id", missingIds);
    if (result.error) throw new Error(result.error.message);
    for (const item of result.data ?? []) historicalItems.set(item.id, item);
  }
  const item = (id: string | null) => {
    if (!id) return null;
    const current = itemById.get(id);
    if (current) return { name: current.name, imagePath: current.imagePath, slot: current.slot, effects: current.effects };
    const archived = historicalItems.get(id);
    return archived ? { name: archived.name, imagePath: archived.image_path, slot: archived.slot_type, effects: normalizeEquipmentEffects(archived.effect_payload) } : null;
  };
  const projects = rows.map((row): EquipmentRndProject => {
    const input = item(row.input_equipment_item_id), output = item(row.prototype_equipment_item_id);
    const snapshot = readEquipmentRndEngineer(row.engineer_snapshot);
    const engineer = snapshot ?? (row.engineer_contract_id ? engineerByContract.get(row.engineer_contract_id) ?? null : null);
    return { id: row.id, requestedPrototypeName: row.prototype_name, engineerContractId: row.engineer_contract_id,
      itemName: input?.name ?? "Équipement historique", prototypeName: output?.name ?? row.prototype_name,
      engineerName: engineer?.name ?? (row.engineer_contract_id ? historicalEngineerNames.get(row.engineer_contract_id) ?? null : null), engineer, staffSnapshotAvailable: !!snapshot, labLevel: Number(row.lab_level),
      ratingKey: row.rating_key, successRate: Number(row.success_rate), outcome: row.outcome, ratingDelta: row.rating_delta === null ? null : Number(row.rating_delta),
      researchCost: Number(row.research_cost), startsGameDayIndex: Number(row.starts_game_day_index), completesGameDayIndex: Number(row.completes_game_day_index), status: row.status,
      focus: isEquipmentRndFocus(row.research_focus) ? row.research_focus : null, imagePath: input?.imagePath ?? output?.imagePath ?? null, slot: input?.slot ?? output?.slot ?? "frame",
      beforeEffects: row.input_effect_payload ? normalizeEquipmentEffects(row.input_effect_payload) : input?.effects ?? null,
      afterEffects: row.output_effect_payload ? normalizeEquipmentEffects(row.output_effect_payload) : output?.effects ?? null, originEffects: row.origin_effect_payload ? normalizeEquipmentEffects(row.origin_effect_payload) : null, completedAt: row.completed_at };
  });
  const activeProjects = projects.filter(project => project.status === "active");
  const busyEngineerContractIds = new Set(activeProjects.flatMap(project => project.engineerContractId ? [project.engineerContractId] : []));
  const labLevel = Number(infra.data?.level ?? 0);
  const eligibleItems = equipment.catalog.filter(item => item.channel !== "equipment_partner" && item.availableQuantity > 0 && SLOT_UNLOCK_LEVEL[item.slot] <= labLevel)
    .map(item => ({ ...item, requiredLabLevel: SLOT_UNLOCK_LEVEL[item.slot], bonusTotal: getEquipmentRndBonusTotal(item.effects), baseDurationDays: getEquipmentRndBaseDurationDays(getEquipmentRndBonusTotal(item.effects)), originEffects: null as EquipmentEffects | null, previousEffects: null as EquipmentEffects | null }));
  const researchableItems = eligibleItems.filter(item => item.bonusTotal < EQUIPMENT_RND_MAX_BONUS).sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name, "fr"));
  for (let offset = 0; offset < researchableItems.length; offset += 200) {
    const result = await supabase.rpc("get_current_equipment_rnd_revisions", { p_item_ids: researchableItems.slice(offset, offset + 200).map(item => item.id) });
    if (result.error) throw new Error(result.error.message);
    const revisions = new Map<string, { originPayload: unknown; previousPayload: unknown }>((Array.isArray(result.data) ? result.data : []).map(row => [row.id, row]));
    for (const item of researchableItems.slice(offset, offset + 200)) {
      const revision = revisions.get(item.id);
      item.originEffects = revision?.originPayload ? normalizeEquipmentEffects(revision.originPayload) : null;
      item.previousEffects = revision?.previousPayload ? normalizeEquipmentEffects(revision.previousPayload) : null;
    }
  }
  return { teamName: equipment.teamName, currentDayNumber: equipment.currentDayNumber, currentGameDayIndex: season.data.game_year * 28 + season.data.current_day_number - 1,
    balance: equipment.balance, currency: equipment.currency, labLevel, labEfficiencyBonusPercentage: Number(infra.data?.efficiency_bonus_percentage ?? 0),
    researchableItems, cappedItemCount: eligibleItems.filter(item => item.bonusTotal >= EQUIPMENT_RND_MAX_BONUS).length,
    engineers, availableEngineers: engineers.filter(engineer => !busyEngineerContractIds.has(engineer.contractId)).slice(0, Math.max(0, engineers.length - activeProjects.length)),
    researchCapacity: engineers.length, activeProjects, recentProjects: projects.filter(project => project.status === "completed") };
}
