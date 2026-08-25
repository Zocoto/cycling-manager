export const GLOBAL_CHAT_MESSAGE_MAX_LENGTH = 500;
export const GLOBAL_CHAT_INITIAL_MESSAGE_LIMIT = 40;
export const GLOBAL_CHAT_MESSAGE_PAGE_SIZE = 30;
export const GLOBAL_CHAT_HISTORY_DAYS = 30;
export const GLOBAL_CHAT_MENTION_MAX_RECIPIENTS = 5;
export const GLOBAL_CHAT_MENTION_SEARCH_MIN_LENGTH = 1;

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
  { key: "train", label: "Train CycloStratège" },
  { key: "late_attack", label: "Attaque au timing parfait" },
  { key: "feed_zone", label: "Ravito chaotique" },
  { key: "puncture", label: "Crevaison" },
  { key: "too_early", label: "Célébration trop tôt" },
  { key: "snack_attack", label: "Gel mal ouvert" },
] as const;

export type GlobalChatCyclingReaction =
  (typeof GLOBAL_CHAT_CYCLING_REACTIONS)[number];
export type GlobalChatCyclingReactionKey = GlobalChatCyclingReaction["key"];

export type GlobalChatCursor = {
  createdAt: string;
  id: string;
};

export type GlobalChatPreviewType = "team" | "rider" | "director";

export type GlobalChatPreviewReference = {
  type: GlobalChatPreviewType;
  entityId: string;
  href: string;
};

export type GlobalChatMentionQuery = {
  query: string;
  start: number;
  end: number;
};

const INTERNAL_ENTITY_PATH =
  /\/jeu\/(?:(equipes|coureurs)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})|directeurs-sportifs\/([^/?#\s),.;!<>]+))(?=$|[/?#\s),.;!?])/i;
const GLOBAL_CHAT_ALLOWED_LINK =
  /^(?:(?:https:\/\/(?:www\.)?|www\.)?cyclostratege\.fr)?\/jeu\/(?:(?:equipes|coureurs)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|directeurs-sportifs\/[^/?#\s<>]+)(?:[/?#][^\s<]*)?$/i;
const GLOBAL_CHAT_URL_LIKE_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<]+|(?:^|[\s<(])((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi;

const GLOBAL_CHAT_REACTION_TOKEN_ANY_PATTERN = /\[cycling-reaction:[^\]]+\]/gi;
const GLOBAL_CHAT_REACTION_KEYS =
  "sprint|climb|attack|victory|train|late_attack|feed_zone|puncture|too_early|snack_attack";
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
      message.replace(
        rule.pattern,
        (_match, prefix: string) => `${prefix}${rule.emoji}`,
      ),
    value,
  );
}

export function stripGlobalChatCyclingReactionTokens(value: string): string {
  return value
    .replace(GLOBAL_CHAT_REACTION_TOKEN_ANY_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGlobalChatMessage(value: string): string {
  return expandGlobalChatEmoticons(value).trim().replace(/\s+/g, " ");
}

export function hasForbiddenGlobalChatLink(value: string): boolean {
  for (const match of value.matchAll(GLOBAL_CHAT_URL_LIKE_PATTERN)) {
    const rawLink = (match[1] ?? match[0])
      .trim()
      .replace(/[),.;!?]+$/, "");
    if (!GLOBAL_CHAT_ALLOWED_LINK.test(rawLink)) return true;
  }

  return false;
}

export function getGlobalChatMentionQuery(
  value: string,
  cursorPosition: number,
): GlobalChatMentionQuery | null {
  const end = Math.min(Math.max(Math.trunc(cursorPosition), 0), value.length);
  const prefix = value.slice(0, end);
  const match = prefix.match(/(?:^|\s)@([^@,\n;:!?]{0,30})$/);
  if (!match) return null;

  const start = prefix.lastIndexOf("@");
  if (start < 0) return null;

  return {
    query: match[1].trimStart(),
    start,
    end,
  };
}

export function globalChatMessageMentionsUsername(
  message: string,
  username: string,
) {
  const normalizedUsername = username.trim().toLocaleLowerCase("fr");
  return (
    normalizedUsername.length > 0 &&
    message.toLocaleLowerCase("fr").includes(`@${normalizedUsername}`)
  );
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
  const key = value
    .match(GLOBAL_CHAT_REACTION_TOKEN_EXACT)?.[1]
    ?.toLowerCase() as GlobalChatCyclingReactionKey | undefined;

  return (
    GLOBAL_CHAT_CYCLING_REACTIONS.find((reaction) => reaction.key === key) ??
    null
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

  if (match[3]) {
    const entityId = safelyDecodePathSegment(match[3]);
    if (!entityId) return null;

    return {
      type: "director",
      entityId,
      href: `/jeu/directeurs-sportifs/${encodeURIComponent(entityId)}`,
    };
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

function safelyDecodePathSegment(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return "";
  }
}
