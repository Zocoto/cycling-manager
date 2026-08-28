"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const messageIdSchema = z.string().uuid();
const messageCleanupScopeSchema = z.enum([
  "read",
  "older_than_7_days",
  "all",
]);
const alertIdSchema = z.string().uuid();
const optionalUuidSchema = z.preprocess(
  emptyValueToUndefined,
  z.string().uuid().optional(),
);
const optionalRatingSchema = z.preprocess(
  emptyValueToUndefined,
  z.coerce.number().int().min(0).max(100).optional(),
);
const optionalPotentialSchema = z.preprocess(
  emptyValueToUndefined,
  z.coerce.number().int().min(1).max(8).optional(),
);
const optionalStaffLevelSchema = z.preprocess(
  emptyValueToUndefined,
  z.coerce.number().int().min(1).max(5).optional(),
);
const riderMetricSchema = z.enum([
  "overall",
  "mountain",
  "hills",
  "recovery",
  "endurance",
  "resistance",
  "breakaway",
  "downhill",
  "acceleration",
  "sprint",
  "flat",
  "cobbles",
  "prologue",
  "timeTrial",
]);
const staffRoleSchema = z.enum([
  "trainer",
  "scout",
  "doctor",
  "mechanic",
  "nutritionist",
  "physiotherapist",
  "race_preparer",
  "architect",
  "community_manager",
  "research_engineer",
]);
const trainerSpecialtySchema = z.enum([
  "mountain",
  "hills",
  "flat",
  "sprint",
  "time_trial",
  "cobbles",
  "endurance",
]);

const riderAlertSchema = z
  .object({
    countryId: optionalUuidSchema,
    metric: riderMetricSchema,
    minimumRating: optionalRatingSchema,
    minimumPotentialSteps: optionalPotentialSchema,
  })
  .refine(
    (value) =>
      value.countryId !== undefined ||
      value.minimumRating !== undefined ||
      value.minimumPotentialSteps !== undefined,
    "Ajoutez au moins un critère à l’alerte coureur.",
  );

const staffAlertSchema = z
  .object({
    countryId: optionalUuidSchema,
    staffRole: z.preprocess(
      emptyValueToUndefined,
      staffRoleSchema.optional(),
    ),
    minimumStaffLevel: optionalStaffLevelSchema,
    trainerSpecialty: z.preprocess(
      emptyValueToUndefined,
      trainerSpecialtySchema.optional(),
    ),
  })
  .refine(
    (value) =>
      value.countryId !== undefined ||
      value.staffRole !== undefined ||
      value.minimumStaffLevel !== undefined ||
      value.trainerSpecialty !== undefined,
    "Ajoutez au moins un critère à l’alerte staff.",
  )
  .refine(
    (value) =>
      value.trainerSpecialty === undefined ||
      value.staffRole === undefined ||
      value.staffRole === "trainer",
    "La spécialité est réservée aux entraîneurs.",
  );

export async function createRiderRecruitmentAlertAction(formData: FormData) {
  const values = parseFormData(riderAlertSchema, formData);
  const supabase = await createSupabaseServerClient();
  const targetsOverall = values.minimumRating !== undefined && values.metric === "overall";
  const { error } = await supabase.rpc(
    "create_current_director_recruitment_alert",
    {
      p_alert_type: "rider",
      p_country_id: values.countryId ?? null,
      p_minimum_overall: targetsOverall ? values.minimumRating : null,
      p_rating_key:
        values.minimumRating !== undefined && !targetsOverall
          ? values.metric
          : null,
      p_minimum_rating:
        values.minimumRating !== undefined && !targetsOverall
          ? values.minimumRating
          : null,
      p_minimum_potential_steps: values.minimumPotentialSteps ?? null,
      p_staff_role: null,
      p_minimum_staff_level: null,
      p_staff_trainer_specialty: null,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de créer l’alerte coureur : ${error.message}`,
    );
  }

  revalidateMailbox();
}

export async function createStaffRecruitmentAlertAction(formData: FormData) {
  const values = parseFormData(staffAlertSchema, formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "create_current_director_recruitment_alert",
    {
      p_alert_type: "staff",
      p_country_id: values.countryId ?? null,
      p_minimum_overall: null,
      p_rating_key: null,
      p_minimum_rating: null,
      p_minimum_potential_steps: null,
      p_staff_role: values.staffRole ?? null,
      p_minimum_staff_level: values.minimumStaffLevel ?? null,
      p_staff_trainer_specialty: values.trainerSpecialty ?? null,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de créer l’alerte staff : ${error.message}`,
    );
  }

  revalidateMailbox();
}

export async function deleteRecruitmentAlertAction(formData: FormData) {
  const result = alertIdSchema.safeParse(formData.get("alertId"));
  if (!result.success) throw new Error("Alerte invalide.");

  const supabase = await createSupabaseServerClient();
  const { data: deleted, error } = await supabase.rpc(
    "delete_current_director_recruitment_alert",
    { p_alert_id: result.data },
  );

  if (error || !deleted) {
    throw new Error(
      error
        ? `Impossible de supprimer l’alerte : ${error.message}`
        : "Cette alerte n’existe pas ou ne vous appartient pas.",
    );
  }

  revalidateMailbox();
}

export async function markAllDirectorMessagesReadAction() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "mark_all_current_director_messages_read",
  );

  if (error) {
    throw new Error(
      `Impossible de marquer les messages comme lus : ${error.message}`,
    );
  }

  revalidateMailbox();
}

export async function markDirectorMessageUnreadAction(formData: FormData) {
  const messageId = readMessageId(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "mark_current_director_message_unread",
    { p_message_id: messageId },
  );

  if (error) {
    throw new Error(
      `Impossible de marquer le message comme non lu : ${error.message}`,
    );
  }

  revalidateMailbox();
}

export async function archiveDirectorMessageAction(formData: FormData) {
  await setMessageArchived(formData, true);
}

export async function deleteDirectorMessageAction(formData: FormData) {
  const messageId = readMessageId(formData);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "delete_current_director_message",
    { p_message_id: messageId },
  );

  if (error || data !== true) {
    throw new Error(
      error
        ? `Impossible de supprimer définitivement ce message : ${error.message}`
        : "Ce message n’existe pas ou ne vous appartient pas.",
    );
  }

  revalidateMailbox();
}

export async function deleteDirectorMessagesAction(formData: FormData) {
  const scope = messageCleanupScopeSchema.safeParse(formData.get("scope"));
  if (!scope.success) throw new Error("Mode de nettoyage invalide.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "delete_current_director_messages",
    { p_scope: scope.data },
  );

  if (error) {
    throw new Error(
      `Impossible de nettoyer définitivement le journal : ${error.message}`,
    );
  }

  revalidateMailbox();
}

export async function restoreDirectorMessageAction(formData: FormData) {
  await setMessageArchived(formData, false);
}

async function setMessageArchived(formData: FormData, archived: boolean) {
  const messageId = readMessageId(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "set_current_director_message_archived",
    {
      p_message_id: messageId,
      p_archived: archived,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de ${archived ? "classer" : "restaurer"} le message : ${error.message}`,
    );
  }

  revalidateMailbox();
}

function readMessageId(formData: FormData) {
  const result = messageIdSchema.safeParse(formData.get("messageId"));
  if (!result.success) throw new Error("Message invalide.");
  return result.data;
}

function emptyValueToUndefined(value: unknown) {
  return value === "" || value === null ? undefined : value;
}

function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): z.infer<T> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Critères invalides.");
  }
  return result.data;
}

function revalidateMailbox() {
  revalidatePath("/jeu/messagerie");
  revalidatePath("/jeu");
}
