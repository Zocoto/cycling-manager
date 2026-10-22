import { CHAT_IMAGE_MAX_EDGE, CHAT_IMAGE_UPLOAD_MAX_BYTES, validateChatImage } from "./chat-images";

export const GAME_NEWS_IMAGE_BUCKET = "game-news-images";
export const GAME_NEWS_IMAGE_UPLOAD_MAX_BYTES = CHAT_IMAGE_UPLOAD_MAX_BYTES;
export const GAME_NEWS_IMAGE_PREFIX = "/images/game-news/";

// Only server-reencoded, content-addressed WebP assets use this route.
export function isGameNewsImageFilename(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}\.webp$/u.test(value);
}

export async function uploadGameNewsIllustration(file: File): Promise<string> {
  const invalid = validateChatImage(file, GAME_NEWS_IMAGE_UPLOAD_MAX_BYTES);
  if (invalid) throw new Error(invalid);
  const form = new FormData();
  form.set("image", file);
  const response = await fetch("/api/game/news/images", {
    method: "POST", body: form, credentials: "same-origin", signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "L’illustration n’a pas pu être importée. Réessayez.");
  const path: unknown = result.image?.path;
  if (typeof path !== "string" || !path.startsWith(GAME_NEWS_IMAGE_PREFIX) ||
    !isGameNewsImageFilename(path.slice(GAME_NEWS_IMAGE_PREFIX.length)) ||
    !Number.isInteger(result.image?.width) || !Number.isInteger(result.image?.height) ||
    result.image.width < 1 || result.image.height < 1 ||
    result.image.width > CHAT_IMAGE_MAX_EDGE || result.image.height > CHAT_IMAGE_MAX_EDGE) {
    throw new Error("L’import de l’illustration n’a pas été confirmé. Réessayez.");
  }
  return path;
}
