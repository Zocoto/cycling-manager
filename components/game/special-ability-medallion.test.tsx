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

  it("rend le médaillon bleu pétrole et la règle de Premier de la classe", () => {
    const ability = SPECIAL_ABILITY_CATALOG.find(
      (candidate) => candidate.code === "first_in_class",
    );
    expect(ability).toBeDefined();

    const markup = renderToStaticMarkup(
      <SpecialAbilityMedallion ability={ability!} unlocked />,
    );

    expect(markup).toContain("Premier de la classe débloquée");
    expect(markup).toContain("50 %");
    expect(markup).toContain("#14666B");
    expect(markup).toContain("M5 9h22v14H5z");
  });

  it("rend le médaillon rose et le biberon de Formé au club", () => {
    const ability = SPECIAL_ABILITY_CATALOG.find(
      (candidate) => candidate.code === "homegrown",
    );
    expect(ability).toBeDefined();

    const markup = renderToStaticMarkup(
      <SpecialAbilityMedallion ability={ability!} unlocked />,
    );

    expect(markup).toContain("Formé au club débloquée");
    expect(markup).toContain("+2");
    expect(markup).toContain("#D65789");
    expect(markup).toContain("M13 4h6l1 4-2 3v3");
  });
});
