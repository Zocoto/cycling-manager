"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { FEDERATION_INFRASTRUCTURE_CODES } from "@/lib/game/federation-infrastructures";
import { isInfrastructureSpecializationChoice } from "@/lib/game/infrastructure-specializations";
import {
  getCountryYouthSpecialties,
  YOUTH_ARCHETYPES,
} from "@/lib/game/youth-development";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FederationInfrastructureActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const infrastructureCodeSchema = z.enum(FEDERATION_INFRASTRUCTURE_CODES);
const prioritySchema = z.enum(["balanced", "cost", "time"]);
const uuidSchema = z.string().uuid();
const youthArchetypeSchema = z.enum(YOUTH_ARCHETYPES);

export async function chooseFederationInfrastructureSpecializationAction(
  _previousState: FederationInfrastructureActionState,
  formData: FormData,
): Promise<FederationInfrastructureActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const infrastructureCode = infrastructureCodeSchema.safeParse(
    formData.get("infrastructureCode"),
  );
  const specializationCode = z.string().trim().min(1).max(80).safeParse(
    formData.get("specializationCode"),
  );
  if (
    !countryCode.success ||
    !infrastructureCode.success ||
    !specializationCode.success ||
    !isInfrastructureSpecializationChoice(
      "federation",
      infrastructureCode.data,
      specializationCode.data,
    )
  ) {
    return failure(
      "La spécialisation transmise ne correspond pas à ce bâtiment fédéral.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(
    "choose_national_federation_infrastructure_specialization",
    {
      p_country_code: countryCode.data,
      p_infrastructure_code: infrastructureCode.data,
      p_specialization_code: specializationCode.data,
    },
  );
  if (result.error) return failure(result.error.message);

  revalidate(countryCode.data);
  const payload = result.data as { status?: string; delayDays?: number } | null;
  return {
    status: "success",
    message:
      payload?.status === "transition"
        ? `La réorientation fédérale sera active dans ${payload.delayDays ?? 7} jours de jeu.`
        : "La spécialisation fédérale est enregistrée.",
  };
}

export async function startFederationSchoolCyclingPlanAction(
  _previousState: FederationInfrastructureActionState,
  formData: FormData,
): Promise<FederationInfrastructureActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const targetArchetype = youthArchetypeSchema.safeParse(
    formData.get("targetArchetype"),
  );
  if (!countryCode.success || !targetArchetype.success) {
    return failure("L’orientation du Plan vélo scolaire est invalide.");
  }
  if (
    getCountryYouthSpecialties(countryCode.data).primary ===
    targetArchetype.data
  ) {
    return failure(
      "Le style historique ne peut pas être choisi comme nouvelle orientation.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(
    "start_national_federation_school_cycling_plan",
    {
      p_country_code: countryCode.data,
      p_target_archetype: targetArchetype.data,
    },
  );
  if (result.error) return failure(result.error.message);
  revalidate(countryCode.data);
  return {
    status: "success",
    message:
      "Le Plan vélo scolaire est financé. Son déploiement de 56 jours commence aujourd’hui.",
  };
}

export async function startFederationInfrastructureProjectAction(
  _previousState: FederationInfrastructureActionState,
  formData: FormData,
): Promise<FederationInfrastructureActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const infrastructureCode = infrastructureCodeSchema.safeParse(
    formData.get("infrastructureCode"),
  );
  const priority = prioritySchema.safeParse(formData.get("priority"));
  if (!countryCode.success || !infrastructureCode.success || !priority.success) {
    return failure("Les paramètres du chantier sont invalides.");
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(
    "start_national_federation_infrastructure_project",
    {
      p_country_code: countryCode.data,
      p_infrastructure_code: infrastructureCode.data,
      p_priority: priority.data,
    },
  );
  if (result.error) return failure(result.error.message);
  revalidate(countryCode.data);
  return {
    status: "success",
    message: "Le chantier a été lancé et débité de la trésorerie fédérale.",
  };
}

export async function contributeArchitectToFederationProjectAction(
  _previousState: FederationInfrastructureActionState,
  formData: FormData,
): Promise<FederationInfrastructureActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const projectId = uuidSchema.safeParse(formData.get("projectId"));
  const staffContractId = uuidSchema.safeParse(formData.get("staffContractId"));
  if (!countryCode.success || !projectId.success || !staffContractId.success) {
    return failure("L’architecte ou le chantier sélectionné est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(
    "contribute_architect_to_federation_project",
    {
      p_project_id: projectId.data,
      p_staff_contract_id: staffContractId.data,
    },
  );
  if (result.error) return failure(result.error.message);
  revalidate(countryCode.data);
  return {
    status: "success",
    message:
      "L’architecte rejoint le chantier. Les économies et le nouveau délai sont enregistrés.",
  };
}

export async function updateFederationProjectPriorityAction(
  _previousState: FederationInfrastructureActionState,
  formData: FormData,
): Promise<FederationInfrastructureActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const projectId = uuidSchema.safeParse(formData.get("projectId"));
  const priority = prioritySchema.safeParse(formData.get("priority"));
  if (!countryCode.success || !projectId.success || !priority.success) {
    return failure("La nouvelle priorité est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(
    "update_national_federation_project_priority",
    {
      p_country_code: countryCode.data,
      p_project_id: projectId.data,
      p_priority: priority.data,
    },
  );
  if (result.error) return failure(result.error.message);
  revalidate(countryCode.data);
  return {
    status: "success",
    message: "La priorité, le coût et la date de livraison ont été recalculés.",
  };
}

function revalidate(countryCode: string) {
  revalidatePath(`/jeu/federations/${countryCode.toLowerCase()}`);
  revalidatePath("/jeu");
  revalidatePath("/jeu/infrastructures");
}

function failure(message: string): FederationInfrastructureActionState {
  console.error("Échec d’opération sur une infrastructure fédérale :", message);
  return {
    status: "error",
    message: message || "L’opération a échoué.",
  };
}
