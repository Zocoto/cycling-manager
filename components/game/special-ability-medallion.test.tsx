import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SPECIAL_ABILITY_CATALOG } from "@/lib/game/special-abilities";

import { SpecialAbilityMedallion } from "./special-ability-medallion";

describe("SpecialAbilityMedallion", () => {
  it("rend le médaillon sombre et la canne de Santé de fer", () => {
    const ability = SPECIAL_ABILITY_CATALOG.find(
      (candidate) => candidate.code === "iron_health",
    );
    expect(ability).toBeDefined();

    const markup = renderToStaticMarkup(
      <SpecialAbilityMedallion ability={ability!} unlocked />,
    );

    expect(markup).toContain("Santé de fer débloquée");
    expect(markup).toContain("réduit ensuite de 30 %");
    expect(markup).toContain("#20272C");
    expect(markup).toContain("M20 5c4 0 6 2 6 5");
  });
});