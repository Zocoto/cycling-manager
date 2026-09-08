"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isTeamInfrastructureCode } from "@/lib/game/infrastructure";
import { isInfrastructureSpecializationChoice } from "@/lib/game/infrastructure-specializations";
import { isStaffAcademyImprovementType } from "@/lib/game/staff-academy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INFRASTRUCTURE_PATH = "/jeu/infrastructures";

export type InfrastructureSpecializationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function chooseTeamInfrastructureSpecializationAction(
  _previousState: InfrastructureSpecializationActionState,
  formData: FormData,
): Promise<InfrastructureSpecializationActionState> {
  const infrastructureCode = readValue(formData, "infrastructureCode");
  const specializationCode = readValue(formData, "specializationCode");
  if (
    !isTeamInfrastructureCode(infrastructureCode) ||
    !isInfrastructureSpecializationChoice(
      "team",
      infrastructureCode,
      specializationCode,
    )
  ) {
    return specializationFailure(
      "La spécialisation transmise ne correspond pas à ce bâtiment.",
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "choose_current_team_infrastructure_specialization",
    {
      p_infrastructure_code: infrastructureCode,
      p_specialization_code: specializationCode,
    },
  );
  if (result.error) return specializationFailure(result.error.message);

  revalidateInfrastructurePages();
  const payload = result.data as {
    status?: string;
    delayDays?: number;
    effectsActive?: boolean;
  } | null;
  return {
    status: "success",
    message:
      payload?.status === "transition"
        ? `La réorientation est enregistrée. Elle sera active dans ${payload.delayDays ?? 7} jours de jeu.`
        : payload?.effectsActive
          ? "La spécialisation est enregistrée et active."
          : "La spécialisation est enregistrée. Ses effets s’activeront avec la Saison 3.",
  };
}

export async function startInfrastructureProjectAction(formData: FormData) {
  const infrastructureCode = readValue(formData, "infrastructureCode");
  const countryId = readValue(formData, "countryId");
  const architectContractId = readValue(
    formData,
    "architectContractId",
  );
  const tab =
    infrastructureCode === "international_youth_center"
      ? "international"
      : "batiments";

  if (
    infrastructureCode !== "international_youth_center" &&
    !isTeamInfrastructureCode(infrastructureCode)
  ) {
    redirectWithMessage(tab, "erreur", "Le chantier transmis est invalide.");
  }
  if (
    infrastructureCode === "international_youth_center" &&
    !isUuid(countryId)
  ) {
    redirectWithMessage(
      tab,
      "erreur",
      "Le pays du centre international est invalide.",
    );
  }
  if (architectContractId && !isUuid(architectContractId)) {
    redirectWithMessage(
      tab,
      "erreur",
      "L’architecte sélectionné est invalide.",
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "start_current_team_infrastructure_project",
    {
      p_infrastructure_code: infrastructureCode,
      p_country_id:
        infrastructureCode === "international_youth_center"
          ? countryId
          : null,
      p_architect_contract_id: architectContractId || null,
    },
  );
  if (result.error) {
    redirectWithMessage(tab, "erreur", result.error.message);
  }

  revalidateInfrastructurePages();
  redirectWithMessage(
    tab,
    "succes",
    "Le chantier est lancé. Son coût a été débité et sa date de livraison est désormais fixée.",
  );
}

export async function startStaffAcademyTrainingAction(formData: FormData) {
  const staffContractId = readValue(formData, "staffContractId");
  const improvementType = readValue(formData, "improvementType");

  if (!isUuid(staffContractId)) {
    redirectStaffTrainingWithMessage("erreur", "Le membre du staff sélectionné est invalide.");
  }
  if (!isStaffAcademyImprovementType(improvementType)) {
    redirectStaffTrainingWithMessage("erreur", "Le type de stage est invalide.");
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "start_current_team_staff_academy_training",
    {
      p_staff_contract_id: staffContractId,
      p_improvement_type: improvementType,
    },
  );
  if (result.error) {
    redirectStaffTrainingWithMessage("erreur", result.error.message);
  }

  revalidateInfrastructurePages();
  revalidatePath("/jeu/staff");
  redirectStaffTrainingWithMessage(
    "succes",
    "Le stage est lancé. Le membre du staff reste pleinement opérationnel jusqu’à l’activation de son amélioration.",
  );
}

function redirectStaffTrainingWithMessage(
  key: "succes" | "erreur",
  message: string,
): never {
  redirect(
    `/jeu/staff?onglet=formations&${key}=${encodeURIComponent(
      message.slice(0, 280),
    )}`,
  );
}
export async function markInfrastructureNotificationsReadAction() {
  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "mark_current_infrastructure_notifications_read",
  );
  if (result.error) {
    redirectWithMessage("batiments", "erreur", result.error.message);
  }
  revalidateInfrastructurePages();
  redirectWithMessage(
    "batiments",
    "succes",
    "Les notifications ont été marquées comme consultées.",
  );
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");
  return supabase;
}

function revalidateInfrastructurePages() {
  revalidatePath(INFRASTRUCTURE_PATH);
  revalidatePath("/jeu/transferts");
  revalidatePath("/jeu/centre-de-formation");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");
}

function redirectWithMessage(
  tab: "batiments" | "international",
  key: "succes" | "erreur",
  message: string,
): never {
  redirect(
    `${INFRASTRUCTURE_PATH}?onglet=${tab}&${key}=${encodeURIComponent(
      message.slice(0, 280),
    )}`,
  );
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function specializationFailure(
  message: string,
): InfrastructureSpecializationActionState {
  console.error("Échec de spécialisation d’infrastructure :", message);
  return {
    status: "error",
    message: message || "La spécialisation n’a pas pu être enregistrée.",
  };
}
