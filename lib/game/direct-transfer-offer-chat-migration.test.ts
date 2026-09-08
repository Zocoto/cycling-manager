import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260908110000_connect_direct_transfer_offers_to_chat.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("direct transfer offer chat migration", () => {
  it("creates one typed and idempotent chat entry per offer", () => {
    expect(migration).toContain("add column if not exists message_type text not null default 'user'");
    expect(migration).toContain("direct_messages_source_reference_unique_idx");
    expect(migration).toContain("public.submit_direct_transfer_offer_with_message(");
    expect(migration).toContain("public.submit_direct_transfer_offer(p_rider_id, p_amount)");
    expect(migration).toContain("'direct-transfer-offer:' || v_offer_id::text || ':chat'");
  });

  it("reuses the private thread and updates unread state atomically", () => {
    expect(migration).toContain("public.get_or_create_current_direct_conversation(");
    expect(migration).toContain("insert into public.direct_messages");
    expect(migration).toContain("update public.direct_conversations as conversation");
    expect(migration).toContain("unread_count = public.direct_conversation_states.unread_count + 1");
  });

  it("keeps the official offer immutable and avoids a duplicate push", () => {
    expect(migration).toContain("v_existing.message_type <> 'user'");
    expect(migration).toContain("if new.message_type = 'transfer_offer' then");
    expect(migration).toContain(
      "revoke execute on function public.submit_direct_transfer_offer(uuid, numeric)",
    );
    expect(migration).toContain(
      "grant execute on function public.submit_direct_transfer_offer_with_message(",
    );
  });
});
