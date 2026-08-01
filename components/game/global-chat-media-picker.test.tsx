import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GlobalChatMediaPicker } from "./global-chat-media-picker";

describe("global chat media picker", () => {
  it("keeps the emoji control without exposing GIF controls", () => {
    const markup = renderToStaticMarkup(
      <GlobalChatMediaPicker onEmojiSelect={() => undefined} />,
    );

    expect(markup).toContain("Ajouter un émoji");
    expect(markup).not.toContain("Ajouter un GIF cycliste");
    expect(markup).not.toContain("GIF 🚴");
    expect(markup).not.toContain("cycling-reactions");
  });
});
