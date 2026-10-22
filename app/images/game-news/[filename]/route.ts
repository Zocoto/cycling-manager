import { GAME_NEWS_IMAGE_BUCKET, isGameNewsImageFilename } from "@/lib/game/game-news-images";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!isGameNewsImageFilename(filename)) return new Response(null, { status: 404 });
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storageUrl) return new Response(null, { status: 503 });
  // Public CDN delivery, no authentication, SQL query or signed-URL request.
  return new Response(null, { status: 302, headers: {
    Location: `${storageUrl}/storage/v1/object/public/${GAME_NEWS_IMAGE_BUCKET}/${filename}`,
    "Cache-Control": "public, max-age=31536000, immutable",
  } });
}
