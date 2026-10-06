import type { GlobalChatMessage } from "@/services/global-chat";
import { isChatImageUuid } from "./chat-images";

const retryMessage = "L’image n’a pas pu être envoyée. Votre brouillon est conservé, vous pouvez réessayer.";

export async function readChatImageSendResponse(response: Response): Promise<GlobalChatMessage> {
  let result: { error?: unknown; message?: GlobalChatMessage } | null = null;
  // Platform failures can return an HTML error page instead of our JSON API.
  if (response.headers.get("content-type")?.includes("application/json")) {
    try { result = await response.json(); } catch { /* Keep a usable retry message. */ }
  }
  if (!response.ok) {
    if (typeof result?.error === "string" && result.error) throw new Error(result.error);
    if (response.status === 401) throw new Error("Reconnectez-vous pour envoyer l’image. Votre brouillon est conservé.");
    if (response.status === 413) throw new Error("L’image est trop volumineuse. Essayez une capture plus petite.");
    throw new Error(retryMessage);
  }
  // Never clear the draft if a redirect, empty response or invalid payload is
  // mistaken for success. A retry uses the same idempotent request identifier.
  if (!isChatImageUuid(result?.message?.id) || typeof result?.message?.message !== "string") {
    throw new Error(retryMessage);
  }
  return result.message;
}
