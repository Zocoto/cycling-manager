import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260908103000_add_equipment_partner_dashboard_alert.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const assistant = readFileSync(
  resolve(process.cwd(), "lib/game/dashboard-assistant.ts"),
  "utf8",
);
const service = readFileSync(
  resolve(process.cwd(), "services/dashboard-assistant.ts"),
  "utf8",
);

describe("alerte équipementier de l’assistant du DS", () => {
  it("conserve le résumé compact sans nouvelle requête cliente", () => {
    expect(migration).toContain(
      "'public.get_current_dashboard_assistant_summary()'::regprocedure",
    );
    expect(migration).toContain("Le point d’insertion de l’alerte équipementier n’est pas unique.");
    expect(migration).toContain("'equipmentPartnerSignatureAvailable'");
    expect(service).toContain("assistantPayload.equipmentPartnerSignatureAvailable");
    expect(service).not.toContain('.rpc("get_current_equipment_partner_alerts")');
  });

  it("reproduit tous les garde-fous de la signature", () => {
    expect(migration).toContain(
      "coalesce(director.reputation_points, 0) >= 200",
    );
    expect(migration).toContain("active_contract.status = 'active'");
    expect(migration).toContain("supplier.status = 'active'");
    expect(migration).toContain("supplier.supports_team_contract");
    expect(migration).toContain(
      "used_contract.supplier_key = supplier.supplier_key",
    );
  });

  it("affiche une alerte actionnable vers la page des équipementiers", () => {
    expect(assistant).toContain('id: "equipment-partner-signature"');
    expect(assistant).toContain('title: "Contrat équipementier disponible"');
    expect(assistant).toContain('href: "/jeu/materiel/equipementier"');
  });
});
