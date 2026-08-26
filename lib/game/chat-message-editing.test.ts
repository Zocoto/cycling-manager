import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CHAT_MESSAGE_EDIT_WINDOW_MS,
  canEditChatMessage,
} from "@/lib/game/chat-message-text";

const globalChat = readFileSync(
  "components/game/global-game-chat.tsx",
  "utf8",
);
const directChat = readFileSync(
  "components/game/direct-messaging-panel.tsx",
  "utf8",
);
const globalActions = readFileSync("app/jeu/chat/actions.ts", "utf8");
const directActions = readFileSync(
  "app/jeu/chat/direct-actions.ts",
  "utf8",
);
const globalService = readFileSync("services/global-chat.ts", "utf8");
const directService = readFileSync("services/direct-messages.ts", "utf8");

describe("chat message editing", () => {
  it("limits editing to the fifteen-minute server window", () => {
    const createdAt = "2026-08-26T08:00:00.000Z";
    const createdAtMs = Date.parse(createdAt);

    expect(canEditChatMessage(createdAt, createdAtMs)).toBe(true);
    expect(
      canEditChatMessage(
        createdAt,
        createdAtMs + CHAT_MESSAGE_EDIT_WINDOW_MS,
      ),
    ).toBe(true);
    expect(
      canEditChatMessage(
        createdAt,
        createdAtMs + CHAT_MESSAGE_EDIT_WINDOW_MS + 1,
      ),
    ).toBe(false);
    expect(canEditChatMessage("date invalide", createdAtMs)).toBe(false);
  });

  it("connects both interfaces to their secured edit RPC", () => {
    expect(globalActions).toContain("editGlobalChatMessageAction");
    expect(globalActions).toContain("edit_current_global_chat_message");
    expect(directActions).toContain("editDirectMessageAction");
    expect(directActions).toContain("edit_current_direct_message");
    expect(globalChat).toContain('aria-label="Modifier ce message"');
    expect(directChat).toContain(
      'aria-label="Modifier ce message privé"',
    );
  });

  it("exposes the edited marker and propagates private edits in realtime", () => {
    expect(globalService).toContain('"edited_at"');
    expect(directService).toContain('"edited_at"');
    expect(globalChat).toContain('" · modifié"');
    expect(directChat).toContain('" · modifié"');
    expect(directChat).toContain('event: "UPDATE"');
    expect(directChat).toContain("upsertDirectMessage(current, message)");
  });
});
