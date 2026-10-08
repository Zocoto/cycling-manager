import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RiderWeightGuideTables } from "./rider-weight-tables";

describe("player-facing weight tables", () => {
  const html = renderToStaticMarkup(createElement(RiderWeightGuideTables));
  it("renders three accessible responsive tables from the shared rules", () => {
    expect(html.match(/<table /g)).toHaveLength(3);
    expect(html).toContain('id="poids-surpoids"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("overflow-x-auto");
    for (const profile of ["Grimpeur", "Coureur de tour", "Baroudeur", "Puncheur", "Rouleur", "Pavéman", "Sprinteur"]) expect(html).toContain(profile);
  });
  it("displays exact tenths at the alert and zero-bonus boundaries", () => {
    for (const value of ["60,5 kg", "64,1 kg", "67,8 kg", "77,6 kg", "79,4 kg", "74,9 kg", "84,1 kg", "85,9 kg", "81,4 kg"]) expect(html).toContain(value);
  });
  it("shows the approved slopes, caps and BMI 30 examples without medical claims", () => {
    for (const value of ["−0,6 point", "−0,8 point", "−1,0 point", "−3 points", "−4 points", "−2,4 points", "−2,8 points", "−4,0 points"]) expect(html).toContain(value);
    expect(html).toContain("pas des classifications médicales");
    expect(html).toContain("Les résultats passés ne changent pas");
  });
});
