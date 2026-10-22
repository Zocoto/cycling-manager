import { createHash } from "node:crypto";
import { GAME_NEWS_IMAGE_BUCKET, GAME_NEWS_IMAGE_PREFIX, GAME_NEWS_IMAGE_UPLOAD_MAX_BYTES } from "@/lib/game/game-news-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentGameStaffRole } from "@/services/game-staff-access";
import { processChatImage } from "@/services/chat-image-processing";

export const runtime = "nodejs";
export const maxDuration = 30;
const bodyLimit = GAME_NEWS_IMAGE_UPLOAD_MAX_BYTES + 32_768;
const headers = { "Cache-Control": "no-store" };
function failure(error: string, status = 400) { return Response.json({ error }, { status, headers }); }

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return failure("Origine de la requête refusée.", 403);
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) return failure("Format d’envoi invalide.");
  if (Number(request.headers.get("content-length")) > bodyLimit) return failure("L’image est trop volumineuse.", 413);
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return failure("Authentification requise.", 401);
    if (!await getCurrentGameStaffRole(supabase)) return failure("Accès réservé à l’équipe du jeu.", 403);
    // Check the actual stream as well as Content-Length, before decoding multipart.
    const reader = request.body?.getReader();
    if (!reader) return failure("Image manquante.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) { await reader.cancel(); return failure("L’image est trop volumineuse.", 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData();
    const file = form.get("image");
    if (!(file instanceof File) || form.getAll("image").length !== 1) return failure("Image manquante.");
    // Reuse the existing bounded decoder: real PNG/JPEG/WebP, EXIF removal,
    // fixed images only, maximum 1600 px and 768 KiB after re-encoding.
    let image: Awaited<ReturnType<typeof processChatImage>>;
    try { image = await processChatImage(file); }
    catch { return failure("Formats acceptés : PNG, JPEG et WebP (images fixes). Maximum 2 Mo."); }
    const filename = `${createHash("sha256").update(image.data).digest("hex")}.webp`;
    const uploaded = await createSupabaseAdminClient().storage.from(GAME_NEWS_IMAGE_BUCKET)
      .upload(filename, image.data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    // Identical processed bytes already at this address are safe to reuse.
    if (uploaded.error && String(uploaded.error.statusCode) !== "409") throw uploaded.error;
    return Response.json({ image: { path: `${GAME_NEWS_IMAGE_PREFIX}${filename}`, width: image.width, height: image.height } }, { headers });
  } catch {
    console.error("game_news_image_upload_failed");
    return failure("L’illustration n’a pas pu être importée. Réessayez.", 503);
  }
}
