"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapRaceLiveMessage,
  type RaceLiveMessage,
} from "@/services/race-live-chat";

type DirectorRow = {
  id: string;
  display_name: string;
};

type MessageRow = {
  id: string;
  stage_id: string;
  sporting_director_id: string;
  author_display_name: string;
  message: string;
  created_at: string;
};

export async function postRaceLiveMessageAction(
  stageId: string,
  rawMessage: string
): Promise<RaceLiveMessage> {
  const message = rawMessage.trim().replace(/\s+/g, " ");

  if (!stageId) {
    throw new Error("Cette étape est introuvable.");
  }

  if (message.length < 1 || message.length > 280) {
    throw new Error(
      "Le message doit contenir entre 1 et 280 caractères."
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    throw new Error("Vous devez être connecté pour commenter.");
  }

  const [directorResult, stageResult] = await Promise.all([
    supabase
      .from("sporting_directors")
      .select("id, display_name")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .maybeSingle<DirectorRow>(),
    supabase
      .from("stages")
      .select("id")
      .eq("id", stageId)
      .maybeSingle<{ id: string }>(),
  ]);

  if (directorResult.error || !directorResult.data) {
    throw new Error(
      "Votre profil de Directeur Sportif est indisponible."
    );
  }

  if (stageResult.error || !stageResult.data) {
    throw new Error("Cette étape est introuvable.");
  }

  const { data: latestMessage } = await supabase
    .from("race_live_messages")
    .select("created_at")
    .eq("sporting_director_id", directorResult.data.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();

  if (
    latestMessage &&
    Date.now() - new Date(latestMessage.created_at).getTime() < 2_000
  ) {
    throw new Error(
      "Patientez un instant avant d’envoyer un nouveau message."
    );
  }

  const { data, error } = await supabase
    .from("race_live_messages")
    .insert({
      stage_id: stageId,
      sporting_director_id: directorResult.data.id,
      author_display_name: directorResult.data.display_name,
      message,
    })
    .select(
      "id, stage_id, sporting_director_id, author_display_name, message, created_at"
    )
    .single<MessageRow>();

  if (error || !data) {
    throw new Error(
      `Impossible d’envoyer le message : ${error?.message ?? "erreur inconnue"}`
    );
  }

  return mapRaceLiveMessage(data);
}
