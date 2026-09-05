import { isChatTranslationTargetLocale } from "@/lib/game/chat-translation";
import type { ChatTranslationTargetLocale } from "@/lib/game/chat-translation";
import { isUuid } from "@/lib/game/direct-messages";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ChatTranslationRateLimitError,
  getOrCreateGlobalChatTranslation,
  isChatProviderFailure,
} from "@/services/global-chat-translation";

type TranslationRouteContext = {
  params: Promise<{ messageId: string }>;
};

type TranslationRequestBody = {
  targetLocale?: unknown;
};

export async function POST(
  request: Request,
  { params }: TranslationRouteContext,
) {
  const { messageId } = await params;
  if (!isUuid(messageId)) {
    return Response.json({ error: "Le message est invalide." }, { status: 400 });
  }

  let body: TranslationRequestBody;
  try {
    body = (await request.json()) as TranslationRequestBody;
  } catch {
    return Response.json(
      { error: "La demande de traduction est invalide." },
      { status: 400 },
    );
  }

  if (!isChatTranslationTargetLocale(body.targetLocale)) {
    return Response.json(
      { error: "La langue cible n’est pas prise en charge." },
      { status: 400 },
    );
  }
  const targetLocale =
    body.targetLocale.toLowerCase() as ChatTranslationTargetLocale;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) {
    return Response.json(
      { error: "Vous devez être connecté pour traduire un message." },
      { status: 401 },
    );
  }

  const [identityResult, messageResult] = await Promise.all([
    supabase.rpc("get_current_global_chat_identity_v3"),
    supabase
      .from("global_chat_messages")
      .select("id, sporting_director_id, message, edited_at")
      .eq("id", messageId)
      .maybeSingle(),
  ]);

  const identity = (
    (identityResult.data as
      | { sporting_director_id: string }[]
      | null) ?? []
  )[0];
  if (identityResult.error || !identity) {
    return Response.json(
      { error: "Votre profil de Directeur Sportif est indisponible." },
      { status: 403 },
    );
  }
  if (messageResult.error || !messageResult.data) {
    return Response.json(
      { error: "Ce message n’est plus disponible." },
      { status: 404 },
    );
  }
  if (
    messageResult.data.sporting_director_id === identity.sporting_director_id
  ) {
    return Response.json(
      { error: "Vos propres messages n’ont pas besoin d’être traduits." },
      { status: 400 },
    );
  }

  try {
    const translation = await getOrCreateGlobalChatTranslation({
      messageId,
      sourceMessage: messageResult.data.message,
      sourceEditedAt: messageResult.data.edited_at,
      targetLocale,
      requesterDirectorId: identity.sporting_director_id,
    });

    return Response.json(translation, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ChatTranslationRateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    if (isChatProviderFailure(error)) {
      return Response.json({ error: error.message }, { status: 503 });
    }

    console.error("Global chat translation failed.", error);
    return Response.json(
      { error: "Le message n’a pas pu être traduit." },
      { status: 500 },
    );
  }
}
