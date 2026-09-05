import { describe, expect, it } from "vitest";

import {
  hasTranslatableChatText,
  isChatTranslationTargetLocale,
  splitChatMessageForTranslation,
} from "./chat-translation";

describe("chat translation", () => {
  it("accepts only application locales", () => {
    expect(isChatTranslationTargetLocale("fr")).toBe(true);
    expect(isChatTranslationTargetLocale("EN")).toBe(true);
    expect(isChatTranslationTargetLocale("de")).toBe(false);
  });

  it("keeps reactions, mentions and internal links out of translation", () => {
    const segments = splitChatMessageForTranslation(
      "[cycling-reaction:sprint] Hello @Jean Dupont, see /jeu/equipes/11111111-1111-4111-8111-111111111111 now",
    );

    expect(segments.filter((segment) => !segment.translate)).toEqual(
      expect.arrayContaining([
        { text: "[cycling-reaction:sprint]", translate: false },
        { text: "@Jean Dupont,", translate: false },
        {
          text: "/jeu/equipes/11111111-1111-4111-8111-111111111111",
          translate: false,
        },
      ]),
    );
    expect(
      segments.filter((segment) => segment.translate).map((segment) => segment.text),
    ).toEqual([" Hello ", " see ", " now"]);
  });

  it("does not offer a provider call for a sticker-only message", () => {
    const segments = splitChatMessageForTranslation(
      "[cycling-reaction:victory] 🎉",
    );

    expect(hasTranslatableChatText(segments)).toBe(false);
  });
});
