import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlobalChatShortcut } from "./global-chat-shortcut";

const { indicators } = vi.hoisted(() => ({ indicators: vi.fn() }));
vi.mock("./game-header-indicators-provider", () => ({
  useGameHeaderIndicators: indicators,
}));

describe("GlobalChatShortcut", () => {
  afterEach(() => indicators.mockReset());

  it("gives an unread quiz priority over red chat notifications on the mobile shortcut", () => {
    indicators.mockReturnValue({ hasUnreadGlobalChatQuiz: true, hasUnreadGlobalChat: true, directMessageUnreadCount: 1 });
    const markup = renderToStaticMarkup(<GlobalChatShortcut floatingOnMobile />);
    expect(markup).toContain("bg-[#C084FC]");
    expect(markup).toContain("nouveau message de Quizz’o Stratège");
    expect(markup).not.toContain("bg-[#EF5B65]");
    expect(renderToStaticMarkup(<GlobalChatShortcut chatIsOpen />)).toContain("bg-[#42B99A]");
  });

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

  it("peut devenir une bulle de chat flottante réservée au mobile", () => {
    const markup = renderToStaticMarkup(
      <GlobalChatShortcut floatingOnMobile />,
    );

    expect(markup).toContain('data-mobile-chat-bubble="true"');
    expect(markup).toContain("mobile-chat-bubble");
  });
});
