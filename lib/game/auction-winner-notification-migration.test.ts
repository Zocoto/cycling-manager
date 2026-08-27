import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = readSource(
  "supabase/migrations/20260827111000_notify_won_transfer_auctions.sql",
);
const mailboxModel = readSource("lib/game/director-mailbox.ts");
const mailboxPage = readSource("app/jeu/messagerie/page.tsx");

describe("auction winner mailbox notification", () => {
  it("adds a dedicated auction mail category to the database and UI", () => {
    expect(migration).toContain("'auction_won'");
    expect(mailboxModel).toContain('| "auction_won"');
    expect(mailboxModel).toContain('auction_won: "Enchère"');
    expect(mailboxPage).toContain('auction_won: "✓"');
  });

  it("waits for a settled auction and its active winning contract", () => {
    expect(migration).toContain(
      "after update of status on public.transfer_market_listings",
    );
    expect(migration).toContain("new.status is distinct from 'settled'");
    expect(migration).toContain("from public.rider_contracts as contract");
    expect(migration).toContain("contract.team_id = new.winning_team_id");
    expect(migration).toContain(
      "contract.acquisition_type in ('daily_auction', 'director_auction')",
    );
  });

  it("sends one important mail to the winning team director", () => {
    expect(migration).toContain(
      "insert into public.sporting_director_messages",
    );
    expect(migration).toContain(
      "'Vous avez remporté l’enchère pour ' || v_rider_name",
    );
    expect(migration).toContain(
      "'transfer-auction-won:' || new.id::text",
    );
    expect(migration).toContain(
      "on conflict (sporting_director_id, source_reference) do nothing",
    );
    expect(migration).toContain("'/jeu/coureurs/' || new.rider_id::text");
    expect(migration).toContain("'Voir le nouveau coureur'");
  });
});
