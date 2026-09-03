import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderInjuryMarker } from "./rider-injury-marker";

describe("RiderInjuryMarker", () => {
  it("affiche une croix rouge et un libellé médical accessible", () => {
    const markup = renderToStaticMarkup(
      <RiderInjuryMarker injuryLabel="Fracture de la clavicule" />,
    );

    expect(markup).toContain('data-rider-injury-marker="true"');
    expect(markup).toContain("Blessé");
    expect(markup).toContain("Fracture de la clavicule");
    expect(markup).toContain('fill="currentColor"');
    expect(markup).toContain("text-[#C42F3A]");
  });
});
