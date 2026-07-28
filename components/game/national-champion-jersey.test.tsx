import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createNationalChampionRiderJersey } from "@/lib/rider-jersey";
import { NationalChampionJersey } from "./national-champion-jersey";
import { RiderAvatar } from "./rider-avatar";

describe("rendu du maillot de champion national", () => {
  it("injecte le drapeau bulgare complet dans le maillot", () => {
    const markup = renderToStaticMarkup(
      <NationalChampionJersey
        countryCode="BG"
        countryName="Bulgarie"
        championshipType="road"
      />,
    );
    expect(markup).toContain('data-national-champion-flag="bg"');
    expect(markup).toContain('href="/images/flags/4x3/bg.svg"');
    expect(markup).not.toContain("foreignObject");
    expect(markup).toContain(
      "Maillot de champion national sur route de Bulgarie",
    );
  });

  it("injecte le drapeau français dans le haut du maillot de l’avatar", () => {
    const markup = renderToStaticMarkup(
      <RiderAvatar
        profileKey={null}
        seed={42}
        riderId="champion-fr"
        jersey={createNationalChampionRiderJersey({
          countryCode: "FR",
          championshipType: "road",
        })}
      />,
    );
    expect(markup).toContain('data-national-champion-flag="fr"');
    expect(markup).toContain('href="/images/flags/4x3/fr.svg"');
    expect(markup).toContain('x="0" y="64" width="96" height="34"');
    expect(markup).toContain("contain:paint");
    expect(markup).not.toContain("foreignObject");
  });
});
