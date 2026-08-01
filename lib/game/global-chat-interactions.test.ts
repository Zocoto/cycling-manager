import { describe, expect, it } from "vitest";

import {
  expandGlobalChatEmoticons,
  extractGlobalChatCyclingReaction,
  isGlobalChatMessageReactionEmoji,
  normalizeGlobalChatMessage,
} from "@/lib/game/global-chat";

describe("global chat interactions", () => {
  it.each([
    [":)", "🙂"],
    [":D", "😄"],
    [":')", "😂"],
    [":'(", "😢"],
    [";)", "😉"],
    ["<3", "❤️"],
    ["XD", "😂"],
  ])("converts %s into %s as soon as it is typed", (text, emoji) => {
    expect(expandGlobalChatEmoticons(text)).toBe(emoji);
  });

  it("converts emoticons inside a sentence without changing internal URLs", () => {
    expect(
      normalizeGlobalChatMessage(
        "Bravo :) https://cyclo-stratege.fr/jeu/coureurs/demo",
      ),
    ).toBe(
      "Bravo 🙂 https://cyclo-stratege.fr/jeu/coureurs/demo",
    );
  });

  it("recognizes the generic message reaction allowlist", () => {
    expect(isGlobalChatMessageReactionEmoji("👍")).toBe(true);
    expect(isGlobalChatMessageReactionEmoji("🚴")).toBe(true);
    expect(isGlobalChatMessageReactionEmoji("🧨")).toBe(false);
    expect(isGlobalChatMessageReactionEmoji(null)).toBe(false);
  });

  it("recognizes the new humorous cycling GIF tokens", () => {
    expect(
      extractGlobalChatCyclingReaction(
        "[cycling-reaction:too_early]",
      ),
    ).toEqual({
      key: "too_early",
      label: "Célébration trop tôt",
    });
    expect(
      extractGlobalChatCyclingReaction(
        "[cycling-reaction:feed_zone]",
      ),
    ).toEqual({ key: "feed_zone", label: "Ravito chaotique" });
  });
});
