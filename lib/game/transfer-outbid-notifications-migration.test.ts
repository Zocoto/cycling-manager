import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821235000_notify_outbid_transfer_bidders.sql",
  ),
  "utf8",
).toLowerCase();

const transferActions = readFileSync(
  resolve(process.cwd(), "app/jeu/transferts/actions.ts"),
  "utf8",
);

describe("notifications de surenchère", () => {
  it("prévient uniquement le précédent meneur après une nouvelle offre", () => {
    expect(migration).toContain(
      "after insert on public.transfer_market_bids",
    );
    expect(migration).toContain("bid.id <> new.id");
    expect(migration).toContain(
      "order by bid.amount desc, bid.created_at asc, bid.id asc",
    );
    expect(migration).toContain("v_previous_bid.team_id = new.team_id");
    expect(migration).toContain("return new;");
  });

  it("ajoute un mail important avec un lien direct vers la bonne enchère", () => {
    expect(migration).toContain(
      "insert into public.sporting_director_messages",
    );
    expect(migration).toContain("vous n’êtes plus en tête pour");
    expect(migration).toContain("enchérir à nouveau");
    expect(migration).toContain(
      "when v_listing.listing_type = 'daily' then 'quotidiennes'",
    );
    expect(migration).toContain("else 'directeurs'");
    expect(migration).toContain("#enchere-");
    expect(migration).toContain("transfer-auction-outbid:");
  });

  it("convertit ce mail en notification push dédupliquée", () => {
    expect(migration).toContain("'transfer_bid_outbid'");
    expect(migration).toContain(
      "new.source_reference like 'transfer-auction-outbid:%'",
    );
    expect(migration).toContain("'mailbox:' || new.source_reference");
    expect(migration).toContain("get_next_decent_push_delivery_at");
    expect(migration).toContain(
      "on conflict (auth_user_id, event_key) do nothing",
    );
  });

  it("lance la distribution push après validation de l’enchère", () => {
    const bidAction = transferActions.slice(
      transferActions.indexOf("export async function placeTransferBidAction"),
      transferActions.indexOf("export async function createDirectorListingAction"),
    );

    expect(bidAction).toContain('supabase.rpc("place_transfer_bid"');
    expect(bidAction).toContain("schedulePushDispatch();");
    expect(bidAction).toContain('revalidatePath("/jeu/messagerie")');
  });
});
