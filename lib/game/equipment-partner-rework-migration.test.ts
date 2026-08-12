import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260812160000_rework_equipment_partner_system.sql",
  ),
  "utf8",
);

const partnerPage = readFileSync(
  join(process.cwd(), "app/jeu/materiel/equipementier/page.tsx"),
  "utf8",
);

const partnerBrands = [
  "altura-forge",
  "vektor-aerolab",
  "brava-sprintworks",
  "kernwerk-cycling",
  "sylva-dynamics",
  "meridian-endurance",
  "axiom-allroad",
];

describe("refonte des équipementiers", () => {
  it("crée sept identités partenaires exclusives et spécialisées", () => {
    for (const brand of partnerBrands) expect(migration).toContain(`'${brand}'`);
    expect(migration).toContain("supports_team_contract = false");
    expect(migration).toContain("'core'");
  });

  it("conserve une dotation virtuelle hors inventaire physique", () => {
    expect(migration).not.toContain(
      "insert into public.team_equipment_inventory",
    );
    expect(migration).toContain("Aucun objet partenaire n'entre dans l'inventaire");
    expect(migration).toContain("v_item.acquisition_channel = 'equipment_partner'");
    expect(migration).toContain("product.offer_type = 'core'");
  });

  it("désactive l'ancienne R&D et les offres aléatoires", () => {
    expect(migration).toContain(
      "revoke all on function public.start_equipment_partner_rnd(uuid)",
    );
    expect(migration).toContain(
      "revoke all on function public.claim_equipment_partner_offer(uuid)",
    );
    expect(migration).not.toContain("random()");
    expect(partnerPage).not.toContain("Propositions rares");
    expect(partnerPage).not.toContain("EQUIPMENT_PARTNER_RARE_OFFER_RATE");
  });

  it("réinitialise uniquement le compte déjà débloqué", () => {
    expect(migration).toContain("Paul.leblanc22@gmail.com");
    expect(migration).toContain("reset_equipment_partner_teams");
    expect(migration).toContain("item.acquisition_channel = 'equipment_partner'");
  });
});
