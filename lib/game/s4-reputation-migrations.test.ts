import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) =>
  readFileSync(`supabase/migrations/${name}.sql`, "utf8").replaceAll("\r", "");

describe("moteur de réputation saison 4", () => {
  it("retire le plafond et sépare valeur, record, engagements et journal", () => {
    const migration = readMigration("20260927200000_create_s4_reputation_system");

    expect(migration).toContain("drop constraint if exists sporting_directors_reputation_points_cap");
    expect(migration).toContain("create table public.reputation_commitments");
    expect(migration).toContain("create table public.reputation_ledger");
    expect(migration).toContain("peak_reputation_points");
    expect(migration).not.toContain("least(new.reputation_points, 1000");
  });

  it("rend les engagements presse transactionnels et ajoute leur bonus au-delà des +25", () => {
    const migration = readMigration("20260927201000_add_s4_press_reputation_commitments");

    expect(migration).toContain("p_commitment_amount integer default 0");
    expect(migration).toContain("private.create_reputation_commitment");
    expect(migration).toContain("private.settle_reputation_commitment");
    expect(migration).toContain("event.event_type = 'pre_race_commitment'");
    expect(migration).toContain("least(8");
  });

  it("appuie les wildcards sans les garantir et règle la mise selon la décision", () => {
    const migration = readMigration("20260927202000_add_s4_wildcard_reputation_support");

    expect(migration).toContain("+ candidate.wildcard_support_bonus");
    expect(migration).toContain("then 0 else 0.40");
    expect(migration).toContain("'withdrawn', 0.25");
    expect(migration).toContain("'cancelled', 0");
  });

  it("dépense atomiquement la réputation pour le sponsor et le quatrième équipement", () => {
    const sponsor = readMigration("20260927203000_add_s4_sponsor_reputation_investment");
    const equipment = readMigration("20260927204000_add_s4_equipment_partner_reputation_extra");

    expect(sponsor).toContain("private.spend_reputation");
    expect(sponsor).toContain("reputation_budget_bonus_percent");
    expect(equipment).toContain("private.spend_reputation");
    expect(equipment).toContain("item.slot_type not in ('frame', 'front_wheel', 'rear_wheel')");
    expect(equipment).toContain("equipment_partner_item_effects");
  });
});
