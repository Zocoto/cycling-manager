export const GLOBAL_CHAT_MESSAGE_MAX_LENGTH = 500;

export type GlobalChatPreviewType = "team" | "rider";

export type GlobalChatPreviewReference = {
  type: GlobalChatPreviewType;
  entityId: string;
  href: string;
};

const INTERNAL_ENTITY_PATH =
  /\/jeu\/(equipes|coureurs)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=$|[/?#\s),.;!?])/i;

export function normalizeGlobalChatMessage(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function extractGlobalChatPreviewReference(
  message: string,
): GlobalChatPreviewReference | null {
  const match = message.match(INTERNAL_ENTITY_PATH);

  if (!match) {
    return null;
  }

  const entityId = match[2].toLowerCase();
  const type = match[1].toLowerCase() === "equipes" ? "team" : "rider";
  const collection = type === "team" ? "equipes" : "coureurs";

  return {
    type,
    entityId,
    href: `/jeu/${collection}/${entityId}`,
  };
}
