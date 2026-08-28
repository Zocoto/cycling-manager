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
    expect(markup).toContain('<button type="button"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("max-sm:fixed");
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
    expect(markup).toContain("Saison 3");
    expect(markup).toContain("divise par deux le salaire");
    expect(markup).toContain("#D65789");
    expect(markup).toContain("M13 4h6l1 4-2 3v3");
  });

  it.each([
    ["pistard", "Pistard", "#2458E6", "m18.8 9.8-4 6"],
    ["three_lungs", "Trois poumons", "#4F941D", "M11.8 10.5c-3.6"],
    ["cyclocrossman", "Cyclocrossman", "#8B4028", "M16 5.8v4"],
    ["metronome", "Métronome", "#C4B5FD", "M9 27h14L20 6"],
  ] as const)(
    "rend l’illustration et la teinte originales de %s",
    (code, name, color, iconPath) => {
      const ability = SPECIAL_ABILITY_CATALOG.find(
        (candidate) => candidate.code === code,
      );
      expect(ability).toBeDefined();

      const markup = renderToStaticMarkup(
        <SpecialAbilityMedallion ability={ability!} unlocked />,
      );

      expect(markup).toContain(`${name} débloquée`);
      expect(markup).toContain(color);
      expect(markup).toContain(iconPath);
    },
  );
});
