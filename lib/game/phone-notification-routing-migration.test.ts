import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = readSource(
  "supabase/migrations/20260827121000_connect_mail_and_direct_message_push.sql",
);
const directActions = readSource("app/jeu/chat/direct-actions.ts");
const transferActions = readSource("app/jeu/transferts/actions.ts");
const pushControl = readSource(
  "components/pwa/push-notification-control.tsx",
);

describe("phone notification routing", () => {
  it("preserves existing events and adds the missing relevant families", () => {
    for (const eventType of [
      "transfer_offer_received",
      "transfer_offer_answered",
      "transfer_bid_outbid",
      "transfer_auction_won",
      "direct_message_received",
      "director_mail_important",
      "global_chat_mention",
    ]) {
      expect(migration).toContain(`'${eventType}'`);
    }
  });

  it("pushes auction victories and important mail without pushing routine mail", () => {
    expect(migration).toContain(
      "new.source_reference like 'transfer-auction-won:%'",
    );
    expect(migration).toContain("when new.is_important");
    expect(migration).toContain("else null");
    expect(migration).toContain("'mailbox:' || new.source_reference");
  });

  it("turns each received private message into a contextual push", () => {
    expect(migration).toContain("create trigger direct_messages_enqueue_push");
    expect(migration).toContain("after insert on public.direct_messages");
    expect(migration).toContain("recipient.auth_user_id");
    expect(migration).toContain("sender.display_name");
    expect(migration).toContain("'direct-message:' || new.id::text");
    expect(migration).toContain("'/jeu/chat?mp=' || new.sender_id::text");
    expect(migration).toContain(
      "public.get_next_decent_push_delivery_at(new.created_at)",
    );
  });

  it("dispatches direct messages and auction settlements without waiting for cron", () => {
    expect(directActions).toContain("scheduleDirectMessagePushDispatch();");
    expect(directActions).toContain("after(async () =>");
    expect(directActions).toContain("limit: 5");
    expect(directActions).toContain("enqueueRaceLives: false");
    expect(transferActions).toContain("schedulePushDispatch();");
    expect(transferActions).toContain("after(async () =>");
    expect(transferActions).toContain("limit: 5");
    expect(transferActions).toContain("enqueueRaceLives: false");
  });

  it("documents the added notification families in the device control", () => {
    expect(pushControl).toContain("Messages privés reçus et mentions");
    expect(pushControl).toContain("enchères remportées");
    expect(pushControl).toContain("sélections, trophées et alertes");
  });
});
