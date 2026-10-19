import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CyclingReactionSticker,
  GlobalChatMediaPicker,
} from "./global-chat-media-picker";

describe("global chat media picker", () => {
  it("exposes two equally sized controls when GIF selection is available", () => {
    const markup = renderToStaticMarkup(
      <GlobalChatMediaPicker onEmojiSelect={() => undefined} onGifSelect={() => undefined} />,
    );

    expect(markup).toContain("Ajouter un émoji");
    expect(markup).not.toContain("Ajouter un GIF cycliste");
    expect(markup).toContain("Ajouter un GIF");
    expect(markup.match(/h-9 w-9/g)).toHaveLength(2);
    expect(markup).not.toContain("api.klipy.com");
  });

  it("renders a local animated cycling sticker", () => {
    const markup = renderToStaticMarkup(
      <CyclingReactionSticker reactionKey="attack" />,
    );

    expect(markup).toContain('data-reaction="attack"');
    expect(markup).toContain("/images/chat/cycling-reactions.webp");
    expect(markup).toContain("Réaction cycliste : Attaque");
  });

  it("renders the new humorous reactions from real looping GIF files", () => {
    const markup = renderToStaticMarkup(
      <CyclingReactionSticker reactionKey="too_early" />,
    );

    expect(markup).toContain('data-reaction="too_early"');
    expect(markup).toContain("/images/chat/reactions/early-celebration.gif");
    expect(markup).toContain("Réaction cycliste : Célébration trop tôt");
  });
});
