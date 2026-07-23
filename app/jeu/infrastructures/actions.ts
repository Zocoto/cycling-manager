"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const INFRASTRUCTURE_PATH = "/jeu/infrastructures";

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
    infrastructureCode !== "recruitment_data_room" &&
    infrastructureCode !== "international_youth_center"
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
