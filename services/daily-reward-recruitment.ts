import "server-only";

import { randomInt } from "node:crypto";

import {
  ARCHITECT_SPECIALTIES,
  type ArchitectSpecialty,
} from "@/lib/game/infrastructure";
import {
  STAFF_ROLE_DEFINITIONS,
  TRAINER_SPECIALTIES,
  isStaffRole,
  type StaffRole,
  type TrainerSpecialty,
} from "@/lib/game/staff";
import {
  getStaffTalentCodes,
  getStaffTalentMinimumLevel,
  type StaffTalentCode,
} from "@/lib/game/staff-talents";
import {
  generateRiderIdentities,
  hasRiderNameLibrary,
} from "@/lib/rider-names/generate-rider-identities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type GeneratedStaffCandidate = {
  firstName: string;
  lastName: string;
  role: StaffRole;
  countryId: string;
  level: number;
  trainerSpecialty: TrainerSpecialty | null;
  architectSpecialty: ArchitectSpecialty | null;
  talentCode: StaffTalentCode;
};

export async function redeemCustomStaffRecruitmentReward({
  authUserId,
  inventoryId,
  role,
  countryId,
}: {
  authUserId: string;
  inventoryId: string;
  role: string;
  countryId: string;
}) {
  if (!isStaffRole(role)) {
    throw new Error("Le métier de staff sélectionné est invalide.");
  }

  const admin = createSupabaseAdminClient();
  const [countryResult, profileResult] = await Promise.all([
    admin
      .from("countries")
      .select("id, name")
      .eq("id", countryId)
      .eq("is_active", true)
      .maybeSingle<{ id: string; name: string }>(),
    admin
      .from("country_rider_generation_profiles")
      .select("name_profile_code")
      .eq("country_id", countryId)
      .maybeSingle<{ name_profile_code: string }>(),
  ]);

  if (countryResult.error) {
    throw new Error(
      `Impossible de vérifier la nationalité : ${countryResult.error.message}`,
    );
  }
  if (profileResult.error) {
    throw new Error(
      `Impossible de charger les noms de cette nationalité : ${profileResult.error.message}`,
    );
  }
  if (!countryResult.data || !profileResult.data) {
    throw new Error("Cette nationalité n’est pas disponible pour le staff.");
  }
  if (!hasRiderNameLibrary(profileResult.data.name_profile_code)) {
    throw new Error(
      `Aucune bibliothèque de noms n’est disponible pour ${countryResult.data.name}.`,
    );
  }

  const candidate = generateStaffCandidate({
    role,
    countryId,
    profileCode: profileResult.data.name_profile_code,
  });
  const result = await admin.rpc("redeem_custom_staff_recruitment_reward", {
    p_auth_user_id: authUserId,
    p_inventory_id: inventoryId,
    p_country_id: candidate.countryId,
    p_first_name: candidate.firstName,
    p_last_name: candidate.lastName,
    p_role: candidate.role,
    p_level: candidate.level,
    p_trainer_specialty: candidate.trainerSpecialty,
    p_architect_specialty: candidate.architectSpecialty,
    p_talent_code: candidate.talentCode,
  });

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function generateStaffCandidate({
  role,
  countryId,
  profileCode,
}: {
  role: StaffRole;
  countryId: string;
  profileCode: string;
}): GeneratedStaffCandidate {
  const identity = generateRiderIdentities(profileCode, 1)[0];
  const level = randomInt(1, 6);
  const trainerSpecialty =
    role === "trainer"
      ? TRAINER_SPECIALTIES[randomInt(0, TRAINER_SPECIALTIES.length)]
      : null;
  const architectSpecialty =
    role === "architect"
      ? ARCHITECT_SPECIALTIES[randomInt(0, ARCHITECT_SPECIALTIES.length)]
      : null;
  const eligibleTalentCodes = getStaffTalentCodes(role).filter(
    (code) =>
      getStaffTalentMinimumLevel(code) <= level &&
      (role !== "trainer" ||
        trainerSpecialty === null ||
        code !== `trainer_${trainerSpecialty}`),
  );

  if (!identity || eligibleTalentCodes.length === 0) {
    throw new Error(
      `Impossible de générer un ${STAFF_ROLE_DEFINITIONS[role].label.toLocaleLowerCase("fr")}.`,
    );
  }

  return {
    firstName: identity.first_name,
    lastName: identity.last_name,
    role,
    countryId,
    level,
    trainerSpecialty,
    architectSpecialty,
    talentCode:
      eligibleTalentCodes[randomInt(0, eligibleTalentCodes.length)]!,
  };
}
