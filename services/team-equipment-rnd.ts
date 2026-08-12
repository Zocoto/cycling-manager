import "server-only";

import type { EquipmentSlot } from "@/lib/game/equipment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentTeamEquipmentOverview,
  type TeamEquipmentCatalogItem,
} from "@/services/team-equipment";

const SLOT_UNLOCK_LEVEL: Record<EquipmentSlot, number> = {
  frame: 1,
  front_wheel: 2,
  rear_wheel: 2,
  helmet: 3,
  shoes: 4,
  bib_shorts: 5,
  gloves: 6,
  glasses: 7,
};

type ProjectRow = {
  id: string;
  input_equipment_item_id: string;
  prototype_equipment_item_id: string | null;
  engineer_contract_id: string | null;
  lab_level: number;
  rating_key: string | null;
  success_rate: number;
  outcome: "improvement" | "setback" | null;
  rating_delta: number | null;
  research_cost: number | string;
  starts_game_day_index: number;
  completes_game_day_index: number;
  status: "active" | "completed" | "cancelled";
  created_at: string;
};

type ContractRow = { id: string; staff_member_id: string };
type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  level: number;
};
type TalentRow = { staff_member_id: string; talent_code: string };

export type EquipmentRndEngineer = {
  contractId: string;
  name: string;
  level: number;
  specialty: "research_time" | "research_cost" | "research_success" | null;
};

export type EquipmentRndProject = {
  id: string;
  itemName: string;
  prototypeName: string | null;
  engineerName: string | null;
  labLevel: number;
  ratingKey: string | null;
  successRate: number;
  outcome: "improvement" | "setback" | null;
  ratingDelta: number | null;
  researchCost: number;
  startsGameDayIndex: number;
  completesGameDayIndex: number;
  status: ProjectRow["status"];
};

export type TeamEquipmentRndOverview = {
  teamName: string;
  currentDayNumber: number;
  currentGameDayIndex: number;
  balance: number;
  currency: string;
  labLevel: number;
  researchableItems: Array<
    TeamEquipmentCatalogItem & { requiredLabLevel: number }
  >;
  engineers: EquipmentRndEngineer[];
  activeProject: EquipmentRndProject | null;
  recentProjects: EquipmentRndProject[];
};

export async function getCurrentTeamEquipmentRndOverview(
  authUserId: string,
): Promise<TeamEquipmentRndOverview | null> {
  const equipment = await getCurrentTeamEquipmentOverview(authUserId);
  if (!equipment) return null;

  const admin = createSupabaseAdminClient();
  await admin.rpc("settle_due_equipment_rnd_projects");

  const [infrastructureResult, projectsResult, contractsResult, seasonResult] =
    await Promise.all([
      admin
        .from("team_infrastructures")
        .select("level")
        .eq("team_id", equipment.teamId)
        .eq("infrastructure_code", "research_lab")
        .maybeSingle<{ level: number }>(),
      admin
        .from("equipment_rnd_projects")
        .select(
          "id,input_equipment_item_id,prototype_equipment_item_id,engineer_contract_id,lab_level,rating_key,success_rate,outcome,rating_delta,research_cost,starts_game_day_index,completes_game_day_index,status,created_at",
        )
        .eq("team_id", equipment.teamId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(12)
        .returns<ProjectRow[]>(),
      admin
        .from("staff_contracts")
        .select("id,staff_member_id")
        .eq("team_id", equipment.teamId)
        .eq("status", "active")
        .returns<ContractRow[]>(),
      admin
        .from("seasons")
        .select("game_year,current_day_number")
        .eq("status", "active")
        .maybeSingle<{ game_year: number; current_day_number: number }>(),
    ]);

  if (infrastructureResult.error)
    throw new Error(infrastructureResult.error.message);
  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (contractsResult.error) throw new Error(contractsResult.error.message);
  if (seasonResult.error || !seasonResult.data) {
    throw new Error(
      seasonResult.error?.message ?? "Saison active introuvable.",
    );
  }

  const contractRows = contractsResult.data ?? [];
  const memberIds = contractRows.map((contract) => contract.staff_member_id);
  const [membersResult, talentsResult] = memberIds.length
    ? await Promise.all([
        admin
          .from("staff_members")
          .select("id,first_name,last_name,level")
          .in("id", memberIds)
          .eq("role", "research_engineer")
          .returns<MemberRow[]>(),
        admin
          .from("staff_member_talents")
          .select("staff_member_id,talent_code")
          .in("staff_member_id", memberIds)
          .returns<TalentRow[]>(),
      ])
    : [
        { data: [] as MemberRow[], error: null },
        { data: [] as TalentRow[], error: null },
      ];
  if (membersResult.error || talentsResult.error) {
    throw new Error(
      membersResult.error?.message ??
        talentsResult.error?.message ??
        "Staff R&D indisponible.",
    );
  }

  const memberById = new Map(
    (membersResult.data ?? []).map((member) => [member.id, member]),
  );
  const talentByMemberId = new Map(
    (talentsResult.data ?? []).map((talent) => [
      talent.staff_member_id,
      talent.talent_code,
    ]),
  );
  const engineers = contractRows.flatMap((contract) => {
    const member = memberById.get(contract.staff_member_id);
    if (!member) return [];
    const talent = talentByMemberId.get(member.id);
    return [
      {
        contractId: contract.id,
        name: `${member.first_name} ${member.last_name}`,
        level: Number(member.level),
        specialty:
          talent === "research_time" ||
          talent === "research_cost" ||
          talent === "research_success"
            ? talent
            : null,
      } satisfies EquipmentRndEngineer,
    ];
  });

  const itemById = new Map(equipment.catalog.map((item) => [item.id, item]));
  const engineerByContractId = new Map(
    engineers.map((engineer) => [engineer.contractId, engineer]),
  );
  const mapProject = (row: ProjectRow): EquipmentRndProject => ({
    id: row.id,
    itemName:
      itemById.get(row.input_equipment_item_id)?.name ?? "Équipement consommé",
    prototypeName: row.prototype_equipment_item_id
      ? (itemById.get(row.prototype_equipment_item_id)?.name ??
        "Prototype unique")
      : null,
    engineerName: row.engineer_contract_id
      ? (engineerByContractId.get(row.engineer_contract_id)?.name ?? null)
      : null,
    labLevel: Number(row.lab_level),
    ratingKey: row.rating_key,
    successRate: Number(row.success_rate),
    outcome: row.outcome,
    ratingDelta: row.rating_delta === null ? null : Number(row.rating_delta),
    researchCost: Number(row.research_cost),
    startsGameDayIndex: Number(row.starts_game_day_index),
    completesGameDayIndex: Number(row.completes_game_day_index),
    status: row.status,
  });
  const projects = (projectsResult.data ?? []).map(mapProject);
  const labLevel = Number(infrastructureResult.data?.level ?? 0);

  return {
    teamName: equipment.teamName,
    currentDayNumber: equipment.currentDayNumber,
    currentGameDayIndex:
      seasonResult.data.game_year * 28 +
      seasonResult.data.current_day_number -
      1,
    balance: equipment.balance,
    currency: equipment.currency,
    labLevel,
    researchableItems: equipment.catalog
      .filter(
        (item) =>
          item.channel !== "equipment_partner" &&
          item.availableQuantity > 0 &&
          SLOT_UNLOCK_LEVEL[item.slot] <= labLevel,
      )
      .map((item) => ({
        ...item,
        requiredLabLevel: SLOT_UNLOCK_LEVEL[item.slot],
      }))
      .sort(
        (left, right) =>
          left.slot.localeCompare(right.slot) ||
          left.name.localeCompare(right.name, "fr"),
      ),
    engineers,
    activeProject:
      projects.find((project) => project.status === "active") ?? null,
    recentProjects: projects.filter(
      (project) => project.status === "completed",
    ),
  };
}

export function estimateEquipmentRndResearch(args: {
  labLevel: number;
  itemPrice: number;
  engineer?: EquipmentRndEngineer | null;
}) {
  const baseDays =
    [18, 16, 14, 12, 10, 9, 8][Math.max(1, args.labLevel) - 1] ?? 18;
  const engineer = args.engineer ?? null;
  const successRate = Math.min(
    95,
    45 +
      args.labLevel * 5 +
      (engineer?.specialty === "research_success" ? engineer.level * 3 : 0),
  );
  const durationDays = Math.max(
    4,
    baseDays - (engineer?.specialty === "research_time" ? engineer.level : 0),
  );
  const cost = Math.round(
    (100_000 + args.labLevel * 50_000 + Math.max(args.itemPrice, 1_000) * 12) *
      (1 -
        (engineer?.specialty === "research_cost" ? engineer.level * 0.05 : 0)),
  );
  return { successRate, durationDays, cost };
}
