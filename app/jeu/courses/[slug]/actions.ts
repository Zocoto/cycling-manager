"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { RACE_ROLES, type RaceRole } from "@/lib/game/race-simulation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function registerRaceRosterAction(
  formData: FormData
) {
  const editionId = readFormValue(
    formData,
    "editionId"
  );
  const slug = readFormValue(formData, "slug");
  const riderIds = formData
    .getAll("riderIds")
    .filter(
      (value): value is string =>
        typeof value === "string" && isUuid(value)
    );
  const submittedRoles = readSubmittedRoles(formData);
  const roster = riderIds.map((riderId) => ({
    riderId,
    role: submittedRoles.get(riderId) ?? "auto",
  }));

  if (!isUuid(editionId) || !isSlug(slug)) {
    redirectWithError(
      "/jeu/calendrier",
      "La course sélectionnée est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { data, error } = await supabase.rpc(
    "save_current_team_competition_roster_with_roles",
    {
      p_race_edition_id: editionId,
      p_roster: roster,
    }
  );

  if (error) {
    redirectWithError(`/jeu/courses/${slug}`, error.message);
  }

  const registrationStatus = Array.isArray(data)
    ? (data[0] as { registration_status?: string } | undefined)
        ?.registration_status
    : null;

  revalidateRacePaths(slug);
  redirect(
    registrationStatus === "pending"
      ? `/jeu/calendrier?wildcard=demandee&course=${encodeURIComponent(slug)}`
      : `/jeu/courses/${slug}?inscription=confirmee#peloton`
  );
}

export async function saveRaceStageRolePlanAction(
  formData: FormData
) {
  const editionId = readFormValue(formData, "editionId");
  const stageId = readFormValue(formData, "stageId");
  const slug = readFormValue(formData, "slug");
  const submittedRoles = readSubmittedRoles(formData, "stageRoles");
  const roles = [...submittedRoles].map(([riderId, role]) => ({
    riderId,
    role,
  }));

  if (
    !isUuid(editionId) ||
    !isUuid(stageId) ||
    !isSlug(slug) ||
    roles.length === 0
  ) {
    redirectWithError(
      isSlug(slug) ? `/jeu/courses/${slug}` : "/jeu/calendrier",
      "Le plan de rôles transmis est invalide."
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

  const { error } = await supabase.rpc(
    "save_current_team_stage_role_plan",
    {
      p_race_edition_id: editionId,
      p_stage_id: stageId,
      p_roles: roles,
    }
  );

  if (error) {
    redirectWithError(`/jeu/courses/${slug}`, error.message);
  }

  revalidateRacePaths(slug);
  redirect(
    `/jeu/courses/${slug}?inscription=roles-mis-a-jour#roles-etapes`
  );
}

export async function withdrawEliteWildcardRequestAction(
  formData: FormData
) {
  const editionId = readFormValue(formData, "editionId");
  const slug = readFormValue(formData, "slug");

  if (!isUuid(editionId) || !isSlug(slug)) {
    redirectWithError(
      "/jeu/calendrier",
      "La course s\u00e9lectionn\u00e9e est invalide."
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

  const { error } = await supabase.rpc(
    "withdraw_current_team_elite_wildcard_request",
    { p_race_edition_id: editionId }
  );

  if (error) {
    redirectWithError(`/jeu/courses/${slug}`, error.message);
  }

  revalidateRacePaths(slug);
  redirect(
    `/jeu/calendrier?wildcard=retiree&course=${encodeURIComponent(slug)}`
  );
}

export async function withdrawRaceRosterAction(
  formData: FormData
) {
  const editionId = readFormValue(
    formData,
    "editionId"
  );
  const slug = readFormValue(formData, "slug");

  if (!isUuid(editionId) || !isSlug(slug)) {
    redirectWithError(
      "/jeu/calendrier",
      "La course sélectionnée est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "withdraw_current_team_from_race",
    { p_race_edition_id: editionId }
  );

  if (error) {
    redirectWithError(`/jeu/courses/${slug}`, error.message);
  }

  revalidateRacePaths(slug);
  redirect(
    `/jeu/calendrier?desinscription=confirmee&course=${encodeURIComponent(
      slug
    )}`
  );
}

function revalidateRacePaths(slug: string) {
  revalidatePath("/jeu/calendrier");
  revalidatePath(`/jeu/courses/${slug}`);
  revalidatePath("/jeu/resultats");
  revalidatePath(`/jeu/resultats/${slug}`);
  revalidatePath("/jeu");
}

export async function replaceInjuredRaceRosterAction(
  formData: FormData
) {
  const editionId = readFormValue(formData, "editionId");
  const slug = readFormValue(formData, "slug");
  const riderIds = formData
    .getAll("riderIds")
    .filter(
      (value): value is string =>
        typeof value === "string" && isUuid(value)
    );
  const submittedRoles = readSubmittedRoles(formData);
  const roster = riderIds.map((riderId) => ({
    riderId,
    role: submittedRoles.get(riderId) ?? "auto",
  }));

  if (!isUuid(editionId) || !isSlug(slug)) {
    redirectWithError(
      "/jeu/calendrier",
      "La course sélectionnée est invalide."
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

  const { error } = await supabase.rpc(
    "replace_current_team_injured_race_roster",
    {
      p_race_edition_id: editionId,
      p_roster: roster,
    }
  );

  if (error) {
    redirectWithError(`/jeu/courses/${slug}`, error.message);
  }

  revalidateRacePaths(slug);
  redirect(`/jeu/courses/${slug}?remplacement=confirme`);
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}erreur=${encodeURIComponent(
      message.slice(0, 300)
    )}`
  );
}

function readFormValue(
  formData: FormData,
  key: string
) {
  const value = formData.get(key);
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    value
  );
}

function readSubmittedRoles(
  formData: FormData,
  fieldName = "riderRoles"
) {
  const roles = new Map<string, RaceRole>();

  for (const value of formData.getAll(fieldName)) {
    if (typeof value !== "string") continue;
    const separatorIndex = value.indexOf(":");
    if (separatorIndex === -1) continue;
    const riderId = value.slice(0, separatorIndex);
    const role = value.slice(separatorIndex + 1);

    if (isUuid(riderId) && RACE_ROLES.includes(role as RaceRole)) {
      roles.set(riderId, role as RaceRole);
    }
  }

  return roles;
}
