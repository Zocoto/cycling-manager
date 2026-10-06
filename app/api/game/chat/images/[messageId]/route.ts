import { CHAT_IMAGE_BUCKET, isChatImageUuid } from "@/lib/game/chat-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const unavailable = () => new Response("Image indisponible", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isChatImageUuid(messageId)) return unavailable();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response("Connexion requise", { status: 401, headers: { "Cache-Control": "no-store" } });
  const result = await supabase.from("global_chat_messages").select("image_path").eq("id", messageId).single();
  if (result.error || !result.data?.image_path) return unavailable();
  const signed = await supabase.storage.from(CHAT_IMAGE_BUCKET).createSignedUrl(result.data.image_path, 3600);
  if (signed.error || !signed.data) return unavailable();
  // Bytes are served by Storage/CDN, not proxied through a Vercel function.
  return new Response(null, { status: 302, headers: { Location: signed.data.signedUrl, "Cache-Control": "private, max-age=300", Vary: "Cookie", "Referrer-Policy": "no-referrer" } });
}
