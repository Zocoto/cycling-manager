import { CHAT_IMAGE_MAX_EDGE, CHAT_IMAGE_UPLOAD_MAX_BYTES, isChatImageUuid, validateChatImage } from "./chat-images";

export const MEDIA_CENTER_IMAGE_BUCKET = "media-center-images";
export const MEDIA_CENTER_IMAGE_UPLOAD_URL = "/api/game/media-center/images";

export type MediaCenterImageUpload = {
  assetId: string;
  src: string;
  width: number;
  height: number;
};

export function isMediaCenterImageSrc(src: unknown): src is string {
  if (typeof src !== "string" || !src.startsWith(`${MEDIA_CENTER_IMAGE_UPLOAD_URL}/`)) return false;
  const [teamId, filename, rest] = src.slice(MEDIA_CENTER_IMAGE_UPLOAD_URL.length + 1).split("/");
  return rest === undefined && isChatImageUuid(teamId)
    && Boolean(filename?.endsWith(".webp") && isChatImageUuid(filename.slice(0, -5)));
}

function isMediaCenterImageUpload(value: unknown): value is MediaCenterImageUpload {
  if (typeof value !== "object" || value === null) return false;
  const { assetId, src, width, height } = value as Partial<MediaCenterImageUpload>;
  return isChatImageUuid(assetId) && isMediaCenterImageSrc(src) && src.endsWith(`/${assetId}.webp`)
    && typeof width === "number" && Number.isInteger(width) && width >= 1 && width <= CHAT_IMAGE_MAX_EDGE
    && typeof height === "number" && Number.isInteger(height) && height >= 1 && height <= CHAT_IMAGE_MAX_EDGE;
}

export async function uploadMediaCenterImage(file: File): Promise<MediaCenterImageUpload> {
  const invalid = validateChatImage(file, CHAT_IMAGE_UPLOAD_MAX_BYTES);
  if (invalid) throw new Error(invalid);

  const form = new FormData();
  form.set("image", file);
  const response = await fetch(MEDIA_CENTER_IMAGE_UPLOAD_URL, {
    method: "POST", body: form, credentials: "same-origin", signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => null) as { error?: unknown; image?: unknown } | null;
  if (!response.ok || !isMediaCenterImageUpload(result?.image)) {
    throw new Error(typeof result?.error === "string" ? result.error : "L’illustration n’a pas pu être importée. Réessayez.");
  }
  return result.image;
}
