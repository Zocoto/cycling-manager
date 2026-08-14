import { describe, expect, it } from "vitest";

import { formatTeamEquipmentOptionLabel } from "@/lib/game/team-equipment-selection";
import type { TeamEquipmentCatalogItem } from "@/services/team-equipment";

describe("formatTeamEquipmentOptionLabel", () => {
  it("réunit le nom, les effets et le stock dans la valeur visible", () => {
    const item = {
      name: "Cadre Aéro",
      effectSummary: "+2 PLA · +1 CLM",
      ownedQuantity: 3,
      isUnlimited: false,
    } as TeamEquipmentCatalogItem;

    expect(formatTeamEquipmentOptionLabel(item, 1)).toBe(
      "Cadre Aéro · +2 PLA · +1 CLM · 2 libres",
    );
  });

  it("conserve une indication explicite pour une dotation illimitée", () => {
    const item = {
      name: "Casque partenaire",
      effectSummary: "+1 END",
      ownedQuantity: 0,
      isUnlimited: true,
    } as TeamEquipmentCatalogItem;

    expect(formatTeamEquipmentOptionLabel(item, 12)).toBe(
      "Casque partenaire · +1 END · dotation illimitée",
    );
  });
});
