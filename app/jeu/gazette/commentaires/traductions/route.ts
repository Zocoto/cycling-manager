import { CHAT_TRANSLATION_BATCH_SIZE } from "@/lib/game/chat-translation";
import { isUuid } from "@/lib/game/direct-messages";
import type { CyclogazetteContent } from "@/lib/game/cyclogazette";
import { getGazetteCommentSources } from "@/lib/game/gazette-comment-translation";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { detectGazetteCommentLanguage } from "@/services/gazette-comment-languages";
import { getOrCreateGazetteCommentTranslations } from "@/services/global-chat-translation";

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Demande invalide." }, { status: 400 }); }
  if (!body || !isUuid(body.editionId) || !["fr", "en"].includes(body.targetLocale) ||
    !Array.isArray(body.messageIds) || body.messageIds.length < 1 || body.messageIds.length > CHAT_TRANSLATION_BATCH_SIZE ||
    !body.messageIds.every((key: unknown) => typeof key === "string" && key.length > 0 && key.length <= 300)) {
    return Response.json({ error: "Lot de traduction invalide." }, { status: 400 });
  }
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) return Response.json({ error: "Connexion requise." }, { status: 401, headers });
  const [identity, edition] = await Promise.all([
    supabase.from("sporting_directors").select("id").eq("auth_user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("cyclogazette_editions").select("content, published_at").eq("id", body.editionId)
      .lte("published_at", new Date().toISOString()).maybeSingle(),
  ]);
  if (identity.error || !identity.data?.id) return Response.json({ error: "Profil indisponible." }, { status: 403, headers });
  if (edition.error) return Response.json({ error: "Édition indisponible." }, { status: 503, headers });
  if (!edition.data || !Number.isFinite(Date.parse(edition.data.published_at)) || Date.parse(edition.data.published_at) > Date.now()) {
    return Response.json({ error: "Édition introuvable." }, { status: 404, headers });
  }
  try {
    const wanted = new Set<string>(body.messageIds);
    // Text comes exclusively from this readable published snapshot. Client text
    // or live unpublished interview answers never reach the paid provider.
    const sources = getGazetteCommentSources(edition.data.content as CyclogazetteContent)
      .filter(source => wanted.has(source.messageId));
    const unchanged = [];
    const pending = [];
    for (const source of sources) {
      const language = detectGazetteCommentLanguage(source.sourceMessage);
      if (language === body.targetLocale || language === "und") {
        unchanged.push({ messageId: source.messageId, status: "loaded", translation: {
          translatedText: source.sourceMessage, detectedSourceLocale: body.targetLocale,
          targetLocale: body.targetLocale, cached: false,
        } });
      } else pending.push(source);
    }
    const translated = pending.length ? await getOrCreateGazetteCommentTranslations({
      sources: pending, targetLocale: body.targetLocale, requesterDirectorId: identity.data.id,
      vercelOidcToken: request.headers.get("x-vercel-oidc-token") ?? undefined,
    }) : [];
    return Response.json({ translations: [...unchanged, ...translated] }, { headers });
  } catch {
    return Response.json({ error: "Traduction momentanément indisponible. Les messages originaux restent disponibles." },
      { status: 503, headers: { ...headers, "Retry-After": "120" } });
  }
}
