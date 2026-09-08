import { normalizeChatMessageText } from "@/lib/game/chat-message-text";
import { extractGlobalChatPreviewReference } from "@/lib/game/global-chat";

export const DIRECT_MESSAGE_MAX_LENGTH = 1000;
export const DIRECT_TRANSFER_OFFER_MESSAGE_MAX_LENGTH = 500;
export const DIRECT_MESSAGE_INITIAL_LIMIT = 30;
export const DIRECT_MESSAGE_PAGE_SIZE = 30;
export const DIRECT_CONVERSATION_PAGE_SIZE = 20;
export const DIRECT_RECIPIENT_SEARCH_MIN_LENGTH = 2;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIRECT_MESSAGE_INTERNAL_LINK_PATTERN =
  /((?:(?:https:\/\/(?:www\.)?|www\.)?cyclostratege\.fr)?\/jeu\/(?:(?:equipes|coureurs)\/[0-9a-f-]{36}|directeurs-sportifs\/[^/?#\s<>]+)(?:[/?#][^\s]*)?)/gi;

export type DirectMessageContentPart = {
  text: string;
  href: string | null;
};

export type DirectMessageCursor = {
  createdAt: string;
  id: string;
};

export type DirectConversationCursor = {
  lastActivityAt: string;
  id: string;
};

export function normalizeDirectMessage(value: string) {
  return normalizeChatMessageText(value);
}

export function splitDirectMessageLinks(
  value: string,
): DirectMessageContentPart[] {
  return value.split(DIRECT_MESSAGE_INTERNAL_LINK_PATTERN).flatMap((text) => {
    if (!text) return [];
    const reference = extractGlobalChatPreviewReference(text);
    return [{ text, href: reference?.href ?? null }];
  });
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function isDirectMessageCursor(
  cursor: DirectMessageCursor,
): boolean {
  return isIsoDate(cursor.createdAt) && isUuid(cursor.id);
}

export function isDirectConversationCursor(
  cursor: DirectConversationCursor,
): boolean {
  return isIsoDate(cursor.lastActivityAt) && isUuid(cursor.id);
}

function isIsoDate(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
}
