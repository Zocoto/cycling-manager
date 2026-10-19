import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAT_EMOJIS, CHAT_REACTION_EMOJIS } from "./chat-emojis";
import { isGlobalChatMessageReactionEmoji } from "./global-chat";

describe("expanded chat emoji catalogue", () => {
  it("keeps all legacy reactions and rejects arbitrary strings", () => {
    for (const emoji of ["👍", "❤️", "😂", "😮", "👏", "🔥", "😢", "😡", "🎉", "🤝", "🚴", "🏆", "🫶", "🤯", "🐗"]) {
      expect(isGlobalChatMessageReactionEmoji(emoji)).toBe(true);
    }
    expect(isGlobalChatMessageReactionEmoji("<script>")).toBe(false);
    expect(isGlobalChatMessageReactionEmoji("hello")).toBe(false);
    expect(CHAT_EMOJIS.length).toBeGreaterThan(200);
    expect(new Set(CHAT_EMOJIS).size).toBe(CHAT_EMOJIS.length);
  });
  it("uses exactly the same finite catalogue in the database", () => {
    const sql = readFileSync("supabase/migrations/20261019090000_add_klipy_chat_gifs_and_emoji_catalog.sql", "utf8");
    const literal = sql.match(/p_emoji = any\(array\[([^\]]+)\]/)?.[1] ?? "";
    const databaseEmojis = [...literal.matchAll(/'([^']+)'/gu)].map(match => match[1]);
    expect(databaseEmojis).toEqual(CHAT_REACTION_EMOJIS);
  });
});
