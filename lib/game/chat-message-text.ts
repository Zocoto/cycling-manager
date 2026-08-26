export const CHAT_MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export function normalizeChatMessageText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .join("\n")
    .trim();
}

export function canEditChatMessage(
  createdAt: string,
  nowMs = Date.now(),
): boolean {
  const createdAtMs = Date.parse(createdAt);
  return (
    Number.isFinite(createdAtMs) &&
    nowMs <= createdAtMs + CHAT_MESSAGE_EDIT_WINDOW_MS
  );
}
