import "server-only";

import {
  STAFF_ACADEMY_MAX_TALENT_LINES,
  calculateStaffAcademyTraining,
  getStaffAcademyCapacity,
  type StaffAcademyImprovementType,
} from "@/lib/game/staff-academy";
import {
  STAFF_ROLE_DEFINITIONS,
  TRAINER_SPECIALTY_LABELS,
  isStaffRole,
  isTrainerSpecialty,
  type StaffRole,
  type TrainerSpecialty,
} from "@/lib/game/staff";
import {
  STAFF_TALENT_DEFINITIONS,
  describeStaffTalent,
  getStaffTalentCodes,
  isStaffTalentCode,
  type StaffTalentCode,
} from "@/lib/game/staff-talents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ContractRow = {
  id: string;
  staff_member_id: string;
};

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  level: number;
  trainer_specialty: string | null;
};

type TalentRow = {
  staff_member_id: string;
  slot_number: number;
  talent_code: string;
};

type TrainingRow = {
  id: string;
  staff_contract_id: string;
  staff_member_id: string;
  improvement_type: StaffAcademyImprovementType;
  previous_level: number;
  previous_talent_count: number;
  cost: number | string;
  duration_days: number;
  starts_game_day_index: number;
  completes_game_day_index: number;
  status: "active" | "completed" | "cancelled";
  awarded_talent_code: string | null;
  completed_at: string | null;
  created_at: string;
};

export type StaffAcademyTalentLine = {
  code: StaffTalentCode;
  slot: number;
  label: string;
  description: string;
};

export type StaffAcademyTraining = {
  id: string;
  contractId: string;
  memberId: string;
  memberName: string;
  improvementType: StaffAcademyImprovementType;
  improvementLabel: string;
  previousLevel: number;
  previousTalentCount: number;
  cost: number;
  durationDays: number;
  remainingDays: number;
  completionGameYear: number;
  completionDayNumber: number;
  progressPercentage: number;
  status: TrainingRow["status"];
  awardedTalentLabel: string | null;
  completedAt: string | null;
};

export type StaffAcademyMember = {
  contractId: string;
  memberId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: StaffRole;
  roleLabel: string;
  level: number;
  trainerSpecialty: TrainerSpecialty | null;
  trainerSpecialtyLabel: string | null;
  talents: StaffAcademyTalentLine[];
  availableTalentLabels: string[];
  levelTraining: ReturnType<typeof calculateStaffAcademyTraining>;
  talentTraining: ReturnType<typeof calculateStaffAcademyTraining>;
  canImproveLevel: boolean;
  canAddTalent: boolean;
  activeTrainingId: string | null;
};

export type StaffAcademyOverview = {
  academyLevel: number;
  capacity: number;
  activeTrainingCount: number;
  members: StaffAcademyMember[];
  activeTrainings: StaffAcademyTraining[];
  recentTrainings: StaffAcademyTraining[];
};

export async function getStaffAcademyOverview(
  supabase: ServerClient,
  authUserId: string,
): Promise<StaffAcademyOverview | null> {
  const settlement = await supabase.rpc("settle_due_staff_academy_trainings");
  assertQuery(settlement.error, "l’achèvement des stages de l’Académie");

  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const [infrastructureResult, contractsResult, trainingsResult] =
    await Promise.all([
      admin
        .from("team_infrastructures")
        .select("level")
        .eq("team_id", context.teamId)
        .eq("infrastructure_code", "staff_academy")
        .maybeSingle<{ level: number }>(),
      admin
        .from("staff_contracts")
        .select("id, staff_member_id")
        .eq("team_id", context.teamId)
        .eq("status", "active")
        .returns<ContractRow[]>(),
      admin
        .from("staff_academy_trainings")
        .select(
          "id, staff_contract_id, staff_member_id, improvement_type, previous_level, previous_talent_count, cost, duration_days, starts_game_day_index, completes_game_day_index, status, awarded_talent_code, completed_at, created_at",
        )
        .eq("team_id", context.teamId)
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<TrainingRow[]>(),
    ]);

  assertQuery(infrastructureResult.error, "l’Académie des métiers");
  assertQuery(contractsResult.error, "les contrats du staff");
  assertQuery(trainingsResult.error, "les stages de l’Académie");

  const contracts = contractsResult.data ?? [];
  const memberIds = [
    ...new Set([
      ...contracts.map((contract) => contract.staff_member_id),
      ...(trainingsResult.data ?? []).map((training) => training.staff_member_id),
    ]),
  ];
  const [membersResult, talentsResult] = memberIds.length
    ? await Promise.all([
        admin
          .from("staff_members")
          .select("id, first_name, last_name, role, level, trainer_specialty")
          .in("id", memberIds)
          .returns<MemberRow[]>(),
        admin
          .from("staff_member_talents")
          .select("staff_member_id, slot_number, talent_code")
          .in("staff_member_id", memberIds)
          .order("slot_number")
          .returns<TalentRow[]>(),
      ])
    : [
        { data: [] as MemberRow[], error: null },
        { data: [] as TalentRow[], error: null },
      ];

  assertQuery(membersResult.error, "les profils du staff");
  assertQuery(talentsResult.error, "les bonus du staff");

  const currentGameDay =
    context.gameYear * 28 + context.currentDayNumber - 1;
  const memberById = new Map(
    (membersResult.data ?? []).map((member) => [member.id, member]),
  );
  const talentsByMemberId = groupBy(
    talentsResult.data ?? [],
    (talent) => talent.staff_member_id,
  );
  const activeTrainingByMemberId = new Map(
    (trainingsResult.data ?? [])
      .filter((training) => training.status === "active")
      .map((training) => [training.staff_member_id, training]),
  );

  const members = contracts.flatMap((contract): StaffAcademyMember[] => {
    const member = memberById.get(contract.staff_member_id);
    if (!member || !isStaffRole(member.role)) return [];

    const role = member.role;
    const trainerSpecialty = toTrainerSpecialty(member.trainer_specialty);
    const talents = (talentsByMemberId.get(member.id) ?? []).flatMap(
      (talent): StaffAcademyTalentLine[] => {
        if (
          !isStaffTalentCode(talent.talent_code) ||
          STAFF_TALENT_DEFINITIONS[talent.talent_code].role !== role
        ) {
          return [];
        }
        return [
          {
            code: talent.talent_code,
            slot: talent.slot_number,
            label: STAFF_TALENT_DEFINITIONS[talent.talent_code].label,
            description: describeStaffTalent(talent.talent_code, member.level),
          },
        ];
      },
    );
    const ownedCodes = new Set(talents.map((talent) => talent.code));
    const availableTalentCodes = getStaffTalentCodes(role).filter(
      (code) =>
        !ownedCodes.has(code) &&
        !(
          code === "architect_parallel_construction" && member.level < 3
        ) &&
        !(
          role === "trainer" &&
          trainerSpecialty &&
          code === `trainer_${trainerSpecialty}`
        ),
    );
    const levelTraining = calculateStaffAcademyTraining({
      improvementType: "level",
      staffLevel: member.level,
      talentCount: talents.length,
    });
    const talentTraining = calculateStaffAcademyTraining({
      improvementType: "talent",
      staffLevel: member.level,
      talentCount: talents.length,
    });

    return [
      {
        contractId: contract.id,
        memberId: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: `${member.first_name} ${member.last_name}`,
        role,
        roleLabel: STAFF_ROLE_DEFINITIONS[role].label,
        level: member.level,
        trainerSpecialty,
        trainerSpecialtyLabel: trainerSpecialty
          ? TRAINER_SPECIALTY_LABELS[trainerSpecialty]
          : null,
        talents,
        availableTalentLabels: availableTalentCodes.map(
          (code) => STAFF_TALENT_DEFINITIONS[code].label,
        ),
        levelTraining,
        talentTraining,
        canImproveLevel: member.level < 5,
        canAddTalent:
          talents.length < STAFF_ACADEMY_MAX_TALENT_LINES &&
          availableTalentCodes.length > 0,
        activeTrainingId:
          activeTrainingByMemberId.get(member.id)?.id ?? null,
      },
    ];
  });

  const trainings = (trainingsResult.data ?? []).flatMap(
    (training): StaffAcademyTraining[] => {
      const member = memberById.get(training.staff_member_id);
      if (!member) return [];
      return [toTraining(training, member, currentGameDay)];
    },
  );
  const academyLevel = infrastructureResult.data?.level ?? 0;

  return {
    academyLevel,
    capacity: getStaffAcademyCapacity(academyLevel),
    activeTrainingCount: trainings.filter(
      (training) => training.status === "active",
    ).length,
    members: members.sort((left, right) =>
      left.roleLabel.localeCompare(right.roleLabel, "fr") ||
      left.fullName.localeCompare(right.fullName, "fr"),
    ),
    activeTrainings: trainings.filter(
      (training) => training.status === "active",
    ),
    recentTrainings: trainings.filter(
      (training) => training.status !== "active",
    ),
  };
}

async function loadContext(admin: AdminClient, authUserId: string) {
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  assertQuery(directorResult.error, "le Directeur Sportif");
  if (!directorResult.data) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", directorResult.data.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<{ team_id: string }>(),
    admin
      .from("seasons")
      .select("game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<{
        game_year: number;
        current_day_number: number | null;
      }>(),
  ]);
  assertQuery(assignmentResult.error, "l’équipe du Directeur Sportif");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  return {
    teamId: assignmentResult.data.team_id,
    gameYear: seasonResult.data.game_year,
    currentDayNumber: seasonResult.data.current_day_number ?? 1,
  };
}

function toTraining(
  training: TrainingRow,
  member: MemberRow,
  currentGameDay: number,
): StaffAcademyTraining {
  const elapsedDays = Math.max(
    0,
    Math.min(
      training.duration_days,
      currentGameDay - training.starts_game_day_index,
    ),
  );
  const awardedTalentCode =
    training.awarded_talent_code &&
    isStaffTalentCode(training.awarded_talent_code)
      ? training.awarded_talent_code
      : null;

  return {
    id: training.id,
    contractId: training.staff_contract_id,
    memberId: training.staff_member_id,
    memberName: `${member.first_name} ${member.last_name}`,
    improvementType: training.improvement_type,
    improvementLabel:
      training.improvement_type === "level"
        ? `Passage au niveau ${training.previous_level + 1}`
        : "Nouvelle ligne de bonus aléatoire",
    previousLevel: training.previous_level,
    previousTalentCount: training.previous_talent_count,
    cost: toNumber(training.cost),
    durationDays: training.duration_days,
    remainingDays:
      training.status === "active"
        ? Math.max(0, training.completes_game_day_index - currentGameDay)
        : 0,
    completionGameYear: Math.floor(training.completes_game_day_index / 28),
    completionDayNumber: (training.completes_game_day_index % 28) + 1,
    progressPercentage:
      training.status === "active"
        ? Math.max(4, (elapsedDays / training.duration_days) * 100)
        : 100,
    status: training.status,
    awardedTalentLabel: awardedTalentCode
      ? STAFF_TALENT_DEFINITIONS[awardedTalentCode].label
      : null,
    completedAt: training.completed_at,
  };
}

function toTrainerSpecialty(value: string | null): TrainerSpecialty | null {
  return value && isTrainerSpecialty(value) ? value : null;
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  }
  return grouped;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
