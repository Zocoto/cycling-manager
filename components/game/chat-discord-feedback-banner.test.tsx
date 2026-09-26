import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatDiscordFeedbackBanner } from "./chat-discord-feedback-banner";

describe("ChatDiscordFeedbackBanner", () => {
  it("affiche le Discord officiel comme point de contact pour les retours", () => {
    const markup = renderToStaticMarkup(<ChatDiscordFeedbackBanner />);

    expect(markup).toContain("Discord");
    expect(markup).toContain("signaler un bug");
    expect(markup).toContain("proposer une amélioration");
    expect(markup).toContain("Retours et signalements");
    expect(markup).toContain("https://discord.gg/EbupEFEQC8");
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('data-chat-discord-banner="true"');
    expect(markup).toContain("sm:hidden");
    expect(markup).toContain("sm:block");
  });

  it("dispose aussi d’une formulation anglaise", () => {
    const markup = renderToStaticMarkup(
      <ChatDiscordFeedbackBanner isEnglish />,
    );

    expect(markup).toContain("report a bug");
    expect(markup).toContain("suggest an improvement");
    expect(markup).toContain("Feedback and bug reports");
    expect(markup).toContain("Join the server");
  });
});
