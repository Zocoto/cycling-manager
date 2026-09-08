import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const actions = readFileSync(
  join(process.cwd(), "app/jeu/transferts/actions.ts"),
  "utf8",
);
const riderPage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);
const chatPanel = readFileSync(
  join(process.cwd(), "components/game/direct-messaging-panel.tsx"),
  "utf8",
);

describe("direct transfer offer chat integration", () => {
  it("accepts an optional note and submits it with the offer", () => {
    expect(riderPage).toContain('name="message"');
    expect(riderPage).toContain("maxLength={500}");
    expect(actions).toContain('readValue(formData, "message")');
    expect(actions).toContain('"submit_direct_transfer_offer_with_message"');
    expect(actions).toContain("p_message: message || null");
  });

  it("renders the immutable offer entry and its rider link in private chat", () => {
    expect(chatPanel).toContain('message.messageType === "transfer_offer"');
    expect(chatPanel).toContain("Offre de transfert");
    expect(chatPanel).toContain("renderDirectMessageText(");
    expect(chatPanel).toContain("splitDirectMessageLinks(message)");
  });
});
