export const GLOBAL_CHAT_MESSAGE_MAX_LENGTH = 500;
export const GLOBAL_CHAT_INITIAL_MESSAGE_LIMIT = 40;
export const GLOBAL_CHAT_MESSAGE_PAGE_SIZE = 30;
export const GLOBAL_CHAT_HISTORY_DAYS = 30;

export const GLOBAL_CHAT_EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😉",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "😮",
  "😱",
  "😢",
  "😭",
  "😡",
  "😤",
  "🙃",
  "😅",
  "👍",
  "👎",
  "👏",
  "🙌",
  "💪",
  "🤝",
  "🙏",
  "❤️",
  "💔",
  "🔥",
  "⚡",
  "🎉",
  "🥳",
  "🏆",
  "🥇",
  "🚴",
  "🚵",
  "🚲",
  "⛰️",
  "🌧️",
  "💨",
  "🚀",
  "✅",
  "❌",
  "👀",
  "🍌",
  "🍼",
] as const;

export const GLOBAL_CHAT_MESSAGE_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "👏",
  "🔥",
  "😢",
  "😡",
  "🎉",
  "🤝",
  "🚴",
  "🏆",
] as const;

export type GlobalChatMessageReactionEmoji =
  (typeof GLOBAL_CHAT_MESSAGE_REACTION_EMOJIS)[number];

export type GlobalChatCursor = {
  createdAt: string;
  id: string;
};

export type GlobalChatPreviewType = "team" | "rider";

export type GlobalChatPreviewReference = {
  type: GlobalChatPreviewType;
  entityId: string;
  href: string;
};

const INTERNAL_ENTITY_PATH =
  /\/jeu\/(equipes|coureurs)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=$|[/?#\s),.;!?])/i;

const GLOBAL_CHAT_REACTION_TOKEN_PATTERN = /\[cycling-reaction:[^\]]+\]/gi;
const GLOBAL_CHAT_CURSOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMOTICON_END = "(?=$|[\\s,.!?;])";
const GLOBAL_CHAT_EMOTICON_RULES: ReadonlyArray<{
  pattern: RegExp;
  emoji: string;
}> = [
  { pattern: new RegExp(`(^|\\s):['’]\\)${EMOTICON_END}`, "g"), emoji: "😂" },
  { pattern: new RegExp(`(^|\\s):['’]\\(${EMOTICON_END}`, "g"), emoji: "😢" },
  { pattern: new RegExp(`(^|\\s):-?[dD]${EMOTICON_END}`, "g"), emoji: "😄" },
  { pattern: new RegExp(`(^|\\s);-?\\)${EMOTICON_END}`, "g"), emoji: "😉" },
  { pattern: new RegExp(`(^|\\s):-?\\)${EMOTICON_END}`, "g"), emoji: "🙂" },
  { pattern: new RegExp(`(^|\\s):-?\\(${EMOTICON_END}`, "g"), emoji: "☹️" },
  { pattern: new RegExp(`(^|\\s):-?[pP]${EMOTICON_END}`, "g"), emoji: "😛" },
  { pattern: new RegExp(`(^|\\s):-?[oO]${EMOTICON_END}`, "g"), emoji: "😮" },
  { pattern: new RegExp(`(^|\\s):\\/${EMOTICON_END}`, "g"), emoji: "😕" },
  { pattern: new RegExp(`(^|\\s)<3${EMOTICON_END}`, "g"), emoji: "❤️" },
  { pattern: new RegExp(`(^|\\s)[xX][dD]${EMOTICON_END}`, "g"), emoji: "😂" },
  { pattern: new RegExp(`(^|\\s)\\^\\^${EMOTICON_END}`, "g"), emoji: "😊" },
];

export function expandGlobalChatEmoticons(value: string): string {
  return GLOBAL_CHAT_EMOTICON_RULES.reduce(
    (message, rule) =>
      message.replace(
        rule.pattern,
        (_match, prefix: string) => `${prefix}${rule.emoji}`,
      ),
    value,
  );
}

export function stripGlobalChatCyclingReactionTokens(value: string): string {
  return value
    .replace(GLOBAL_CHAT_REACTION_TOKEN_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGlobalChatMessage(value: string): string {
  return stripGlobalChatCyclingReactionTokens(expandGlobalChatEmoticons(value));
}

export function isGlobalChatMessageReactionEmoji(
  value: unknown,
): value is GlobalChatMessageReactionEmoji {
  return (
    typeof value === "string" &&
    (GLOBAL_CHAT_MESSAGE_REACTION_EMOJIS as readonly string[]).includes(value)
  );
}

export function getGlobalChatHistoryStart(now = new Date()) {
  return new Date(
    now.getTime() - GLOBAL_CHAT_HISTORY_DAYS * 24 * 60 * 60 * 1_000,
  ).toISOString();
}

export function isGlobalChatCursor(value: unknown): value is GlobalChatCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Record<string, unknown>;

  const createdAt =
    typeof cursor.createdAt === "string" ? cursor.createdAt : "";
  const createdAtTimestamp = Date.parse(createdAt);

  return (
    Number.isFinite(createdAtTimestamp) &&
    new Date(createdAtTimestamp).toISOString() === createdAt &&
    typeof cursor.id === "string" &&
    GLOBAL_CHAT_CURSOR_ID.test(cursor.id)
  );
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
