import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814100000_create_web_push_notifications.sql",
  ),
  "utf8",
).toLowerCase();

describe("web push notifications migration", () => {
  it("stores private subscriptions and a deduplicated delivery outbox", () => {
    expect(migration).toContain("create table public.push_subscriptions");
    expect(migration).toContain("create table public.push_notification_outbox");
    expect(migration).toContain("unique (auth_user_id, event_key)");
    expect(migration).toContain("alter table public.push_subscriptions enable row level security");
    expect(migration).toContain("upsert_current_push_subscription");
    expect(migration).toContain("where auth_user_id = auth.uid()");
  });

  it("covers every requested game event", () => {
    for (const eventType of [
      "race_live_started",
      "transfer_offer_received",
      "transfer_offer_answered",
      "cyclogazette_published",
      "scouting_completed",
      "infrastructure_completed",
    ]) {
      expect(migration).toContain(`'${eventType}'`);
    }

    expect(migration).toContain("direct-transfer-offer:%:received");
    expect(migration).toContain("direct-transfer-offer:%:accepted");
    expect(migration).toContain("direct-transfer-offer:%:rejected");
    expect(migration).toContain("scouting-report:%");
    expect(migration).toContain("infrastructure:%");
    expect(migration).toContain("cyclogazette_editions_enqueue_push");
  });

  it("only alerts registered teams when a live actually starts", () => {
    expect(migration).toContain("enqueue_due_race_live_push_notifications");
    expect(migration).toContain("registration.status = 'accepted'");
    expect(migration).toContain("stage.departure_at <= now()");
    expect(migration).toContain("race-live:");
    expect(migration).toContain("/jeu/resultats/");
  });

  it("enforces quiet hours in Paris and claims deliveries atomically", () => {
    expect(migration).toContain("at time zone 'europe/paris'");
    expect(migration).toContain("time '08:00'");
    expect(migration).toContain("time '22:00'");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("claim_due_push_notifications");
  });
});
