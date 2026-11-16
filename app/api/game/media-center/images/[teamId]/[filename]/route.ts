import { MEDIA_CENTER_IMAGE_BUCKET, MEDIA_CENTER_IMAGE_UPLOAD_URL, isMediaCenterImageSrc } from "@/lib/game/media-center-images";

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string; filename: string }> }) {
  const { teamId, filename } = await params;
  const path = `${teamId}/${filename}`;
  if (!isMediaCenterImageSrc(`${MEDIA_CENTER_IMAGE_UPLOAD_URL}/${path}`)) return new Response(null, { status: 404 });

  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storageUrl) return new Response(null, { status: 503 });
  return new Response(null, { status: 302, headers: {
    Location: new URL(`/storage/v1/object/public/${MEDIA_CENTER_IMAGE_BUCKET}/${path}`, storageUrl).href,
    "Cache-Control": "public, max-age=31536000, immutable",
  } });
}
