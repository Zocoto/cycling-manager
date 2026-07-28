import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GlobalChatShortcut } from "./global-chat-shortcut";

describe("GlobalChatShortcut", () => {
  it("affiche une pastille verte quand le chat est à jour", () => {
    const markup = renderToStaticMarkup(<GlobalChatShortcut />);

    expect(markup).toContain('data-chat-unread="false"');
    expect(markup).toContain("bg-[#42B99A]");
    expect(markup).not.toContain("nouveaux messages non lus");
  });

  it("affiche une pastille rouge et un libellé explicite si nécessaire", () => {
    const markup = renderToStaticMarkup(
      <GlobalChatShortcut initialHasUnread />,
    );

    expect(markup).toContain('data-chat-unread="true"');
    expect(markup).toContain("bg-[#EF5B65]");
    expect(markup).toContain("nouveaux messages non lus");
  });

  it("reste vert pendant la consultation du chat", () => {
    const markup = renderToStaticMarkup(
      <GlobalChatShortcut chatIsOpen initialHasUnread />,
    );

    expect(markup).toContain('data-chat-unread="false"');
    expect(markup).toContain("bg-[#42B99A]");
  });
});
