import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EquipmentRatingBonus } from "./equipment-rating-bonus";

describe("EquipmentRatingBonus", () => {
  it("affiche un bonus positif en bleu à côté de la note nominale", () => {
    const markup = renderToStaticMarkup(<EquipmentRatingBonus bonus={4} />);

    expect(markup).toContain("Bonus équipement : +4");
    expect(markup).toContain("text-[#2E82C4]");
    expect(markup).toContain("+4");
  });

  it("masque les valeurs nulles", () => {
    expect(renderToStaticMarkup(<EquipmentRatingBonus bonus={0} />)).toBe("");
  });
});