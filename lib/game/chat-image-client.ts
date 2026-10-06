import { CHAT_IMAGE_MAX_EDGE, CHAT_IMAGE_MAX_PIXELS, CHAT_IMAGE_UPLOAD_MAX_BYTES, validateChatImage } from "@/lib/game/chat-images";

export async function prepareChatImage(file: File): Promise<File> {
  const invalid = validateChatImage(file);
  if (invalid) throw new Error(invalid);
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > CHAT_IMAGE_MAX_PIXELS) throw new Error("L’image est trop grande : 24 millions de pixels maximum.");
    const ratio = Math.min(1, CHAT_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Votre navigateur ne peut pas préparer cette image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
    if (!blob || blob.size > CHAT_IMAGE_UPLOAD_MAX_BYTES) throw new Error("L’image reste trop volumineuse. Essayez une capture plus petite.");
    return new File([blob], "image-chat.webp", { type: blob.type });
  } finally { bitmap.close(); }
}
