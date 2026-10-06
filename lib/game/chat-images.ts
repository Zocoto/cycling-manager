export const CHAT_IMAGE_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const CHAT_IMAGE_STORED_MAX_BYTES = 768 * 1024;
export const CHAT_IMAGE_MAX_EDGE = 1600;
export const CHAT_IMAGE_MAX_PIXELS = 24_000_000;
export const CHAT_IMAGE_BUCKET = "global-chat-images";
export const CHAT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type ChatImageAttachment = { href: string; width: number; height: number };

export function isChatImageOnlyMessage(message: { image?: ChatImageAttachment | null; message: string }) {
  return Boolean(message.image) && message.message === "Image jointe";
}

export function isChatImageUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateChatImage(file: Pick<File, "type" | "size">, maxBytes = CHAT_IMAGE_SOURCE_MAX_BYTES) {
  if (!(CHAT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Formats acceptés : PNG, JPEG et WebP (images fixes).";
  }
  if (file.size <= 0 || file.size > maxBytes) {
    return maxBytes === CHAT_IMAGE_SOURCE_MAX_BYTES
      ? "L’image doit peser moins de 10 Mo."
      : "L’image est trop volumineuse pour être envoyée.";
  }
  return null;
}

// A browser paste event is enough: no clipboard-read permission or remote URL fetching.
export function getPastedChatImages(clipboard: Pick<DataTransfer, "items" | "files">): File[] {
  const images = Array.from(clipboard.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return images.length ? images : Array.from(clipboard.files ?? []).filter((file) => file.type.startsWith("image/"));
}

export function readChatImageAttachment(row: { id?: unknown; image_path?: unknown; image_width?: unknown; image_height?: unknown }): ChatImageAttachment | null {
  if (!isChatImageUuid(row.id) || typeof row.image_path !== "string" ||
      !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(row.image_path) ||
      typeof row.image_width !== "number" || typeof row.image_height !== "number" ||
      !Number.isInteger(row.image_width) || !Number.isInteger(row.image_height) ||
      row.image_width < 1 || row.image_height < 1 ||
      row.image_width > CHAT_IMAGE_MAX_EDGE || row.image_height > CHAT_IMAGE_MAX_EDGE) return null;
  return { href: `/api/game/chat/images/${row.id}`, width: row.image_width, height: row.image_height };
}
