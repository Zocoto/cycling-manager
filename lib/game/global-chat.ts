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

export const GLOBAL_CHAT_CYCLING_REACTIONS = [
  { key: "sprint", label: "Sprint" },
  { key: "climb", label: "Grimpe" },
  { key: "attack", label: "Attaque" },
  { key: "victory", label: "Victoire collective" },
  { key: "feed_zone", label: "Ravito chaotique" },
  { key: "puncture", label: "Crevaison" },
  { key: "too_early", label: "Célébration trop tôt" },
  { key: "snack_attack", label: "Poches pleines" },
] as const;

export type GlobalChatCyclingReaction =
  (typeof GLOBAL_CHAT_CYCLING_REACTIONS)[number];
export type GlobalChatCyclingReactionKey =
  GlobalChatCyclingReaction["key"];

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

const GLOBAL_CHAT_REACTION_KEYS =
  "sprint|climb|attack|victory|feed_zone|puncture|too_early|snack_attack";
const GLOBAL_CHAT_REACTION_TOKEN_PATTERN = new RegExp(
  `(\\[cycling-reaction:(?:${GLOBAL_CHAT_REACTION_KEYS})\\])`,
  "gi",
);
const GLOBAL_CHAT_REACTION_TOKEN_EXACT = new RegExp(
  `^\\[cycling-reaction:(${GLOBAL_CHAT_REACTION_KEYS})\\]$`,
  "i",
);
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
      message.replace(rule.pattern, (_match, prefix: string) => `${prefix}${rule.emoji}`),
    value,
  );
}

export function normalizeGlobalChatMessage(value: string): string {
  return expandGlobalChatEmoticons(value).trim().replace(/\s+/g, " ");
}

export function buildGlobalChatMessage({
  text,
  reactionKey,
}: {
  text: string;
  reactionKey: GlobalChatCyclingReactionKey | null;
}) {
  return normalizeGlobalChatMessage(
    [reactionKey ? `[cycling-reaction:${reactionKey}]` : "", text]
      .filter(Boolean)
      .join(" "),
  );
}

export function extractGlobalChatCyclingReaction(
  value: string,
): GlobalChatCyclingReaction | null {
  const key = value.match(GLOBAL_CHAT_REACTION_TOKEN_EXACT)?.[1]
    ?.toLowerCase() as GlobalChatCyclingReactionKey | undefined;

  return (
    GLOBAL_CHAT_CYCLING_REACTIONS.find(
      (reaction) => reaction.key === key,
    ) ?? null
  );
}

export function splitGlobalChatMessageContent(value: string) {
  return value.split(GLOBAL_CHAT_REACTION_TOKEN_PATTERN).filter(Boolean);
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

export function isGlobalChatCursor(
  value: unknown,
): value is GlobalChatCursor {
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
