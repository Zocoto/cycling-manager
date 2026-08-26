import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260826120000_create_medical_crisis_trophies.sql",
  ),
  "utf8",
);
const profileAction = readFileSync(
  resolve(process.cwd(), "app/jeu/directeur-sportif/actions.ts"),
  "utf8",
);

describe("Medical crisis trophies migration", () => {
  it("counts distinct unavailable riders and evaluates every new injury", () => {
    expect(migration).toContain("count(distinct contract.rider_id)");
    expect(migration).toContain("injury.status = 'active'");
    expect(migration).toContain("injury.expected_recovery_at > now()");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain("after insert on public.rider_injuries");
  });

  it("awards both career thresholds and their one-time financial support", () => {
    expect(migration).toContain("'ambulancier'::text");
    expect(migration).toContain("'medecin_urgentiste'::text");
    expect(migration).toContain("25000::numeric");
    expect(migration).toContain("75000::numeric");
    expect(migration).toContain(
      "on conflict (sporting_director_id, trophy_key) do nothing",
    );
    expect(migration).toContain("on conflict (source_reference) do nothing");
    expect(migration).toContain("cash_balance = cash_balance + v_award.cash_reward");
    expect(migration).toContain("from public.alpha_bot_managers as bot");
  });

  it("protects both SVG outfits in the database and server action", () => {
    expect(migration).toContain("v_outfit_key = 'nurse-cap'");
    expect(migration).toContain("v_outfit_key = 'emergency-doctor'");
    expect(migration).toContain("trophy.claimed_at is not null");
    expect(profileAction).toContain("AMBULANCIER_AVATAR_OUTFIT_KEY");
    expect(profileAction).toContain("EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY");
  });
});
