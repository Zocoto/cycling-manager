export function normalizeChatMessageText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .join("\n")
    .trim();
}
