"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { FEDERATION_INFRASTRUCTURE_CODES } from "@/lib/game/federation-infrastructures";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FederationInfrastructureActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialFederationInfrastructureActionState: FederationInfrastructureActionState =
  { status: "idle", message: "" };

const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const infrastructureCodeSchema = z.enum(FEDERATION_INFRASTRUCTURE_CODES);
const prioritySchema = z.enum(["balanced", "cost", "time"]);
const uuidSchema = z.string().uuid();

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
